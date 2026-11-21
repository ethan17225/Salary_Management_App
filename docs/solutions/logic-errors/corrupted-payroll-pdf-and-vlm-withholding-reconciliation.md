---
title: Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads
date: 2026-11-21
category: logic-errors
module: paycheques
problem_type: logic_error
component: service_layer
symptoms:
  - "ADP Earnings Statement PDFs with embedded text bypassed local Vision AI and RapidOCR, returning hallucinated $200,000.00 net/gross amounts from CPU fallback"
  - "Non-thinking 4B vision model (qwen3-vl:4b-instruct) misread Deposit Acct1 -1,405.71 into deductions (405.71), triggering gross-to-net breakdown warnings"
  - "Small vision models failed to mentally sum unsummed statutory lines (Federal Tax, EI, CPP) and read Pay End Date instead of Advice Date on 1024px paystub images"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - paystub-parsing
  - pdf-text
  - vision-ocr
  - qwen3-vl
  - adp
  - withholding-reconciliation
---

# Corrupted-font payroll PDFs bypassing vision escalation and VLM withholding misreads

## Problem
Legacy payroll PDFs such as ADP Earnings Statements contain thousands of characters of embedded text whose custom font encoding emits hundreds of `(cid:0)` glyphs, strips decimal points (`$1 718 09`, `$1 405 71`, `-190 83`), and omits logo-only employer names (`Softchoice`). Because `parse_upload` previously escalated PDFs to Vision AI or RapidOCR only when `len(text) < 20`, these PDFs bypassed image-based extraction and produced wildly inaccurate fallback results. Even after rendering them to images, small non-thinking local VLMs (`qwen3-vl:4b-instruct`) misread direct-deposit distribution lines (`Deposit Acct1 -1,405.71`) as deductions and could not reliably sum unsummed statutory withholdings in one pass.

## Symptoms
- Uploading an ADP Softchoice PDF returned `parser_used: "pdf_text"`, `used_llm_fallback: true`, `source_name: "CO. FILE DEPT. CLOCK VCHR. NO. 086 Earnings"`, `amount: "200000.00"`, `gross: "200000.00"`, and an outlier warning.
- Rendering the ADP PDF directly into `qwen3-vl:4b-instruct` extracted `Softchoice`, `2026-08-31`, `gross: "1718.09"`, `amount: "1405.71"`, and `hours: 78.67` accurately, but returned `tax: "190.83"` and `deductions: "405.71"`, failing `validate_paystub_breakdown` (`Sum of taxes and deductions cannot exceed the difference between gross and net pay.`).
- Testing `qwen3-vl:2b-instruct` (captured via live `import_pipeline_logs`) copied year-to-date columns (`1,716.32`, `1,205.66`) instead of current-period figures (`190.83`, `28.00`, `93.55`).

## What Didn't Work
- **Checking only `len(text) < 20` for PDF escalation:** `pdfplumber` returned over 3,000 characters on the ADP PDF—mostly `(cid:0)` sequences that filled `MAX_LLM_CHARS` (`1800` in `backend/src/paycheques/extractors.py`) before the actual paystub body even reached CPU `Qwen2.5-0.5B`.
- **Prompting `qwen3-vl:4b-instruct` to sum `tax` and `deductions` directly:** Asking the non-thinking 4B model to mentally add `EI (28.00) + CPP (93.55)` and ignore `Deposit Acct1` still produced `deductions: 405.71` because `-1,405.71` sits inside the Deductions column under Net Pay.
- **Adding separate `tax_items` and `deduction_items` fields naming "Federal/Provincial" tax:** Mentioning "Federal/Provincial" caused `qwen3-vl:4b-instruct` to scrape `Exemptions/Allowances: Federal: $16452 / Provincial: $12989` into `tax_items` (`[1645.2, 1298.9]`), and the longer prompt degraded paystub date selection.
- **Downscaling paystub images to `MAX_VISION_IMAGE_PX = 1024`:** Tiny header labels on rendered PeopleSoft/Sheridan stubs blurred enough at 1024px that `qwen3-vl:4b-instruct` picked `Pay End Date` (`09/05`) instead of `Advice Date` (`09/18`).
- **Using `qwen3-vl:2b-instruct` as the local vision model:** Even with the updated prompt and 1280px resolution, `2b` mixed YTD figures into current-period tax and deduction fields.

## Solution
1. **Escalate incomplete or corrupted `pdf_text` in `parse_upload` (`backend/src/paycheques/parsers.py`):**
   - Strip `(cid:\d+)` runs with `_CID_GARBAGE_RE` while recording `has_cid_garbage = "(cid:" in raw_text`.
   - Run deterministic rule extraction (`_deterministic_text_row`) first so clean digital PDFs (such as Sheridan PeopleSoft stubs) still return in `pdf_text` mode with zero AI overhead.
   - When deterministic `pdf_text` leaves warnings:
     - Escalate to Vision AI (`_try_vision_parse`) whenever `extractors.vision_available()` is enabled (`OCR_RUNTIME=local`).
     - In Docker CPU mode (or if Vision fails), escalate to `extractors.ocr_text` whenever `has_cid_garbage` is true or no `amount` was found alongside space-broken currency matching `_BROKEN_MONEY_RE` (`\$\s*\d[\d\s]+\d{2}\b`), leaving clean unlabeled text PDFs on the existing `_llm_fallback_for_text` path.

2. **Extract itemized `withholdings` and reconcile in exact integer cents:**
   - Raised `MAX_VISION_IMAGE_PX` from `1024` to `1280` and updated `VISION_PROMPT` in `backend/src/paycheques/extractors.py` to ignore `YTD`, `Exemptions/Allowances`, and `Deposit Acct / Direct Deposit` lines while returning a single optional `withholdings` array (`[{"label": string, "amount": "0.00"}]`).
   - Added `_reconcile_vision_withholdings` (called from `_row_from_vision` in `backend/src/paycheques/parsers.py`):
     - Keeps `tax` and `deductions` untouched whenever `(tax + deductions)` already matches `gross - net` within 1 cent (preserving pre-summed stubs like Sheridan's `2.82 + 3.75`).
     - Otherwise filters out non-positive items, values exceeding `gross - net`, and deposit/employer-benefit lines matching `_IGNORED_WITHHOLDING_RE`. When the remaining items sum to `gross - net` within 1 cent, partitions items matching `_STATUTORY_TAX_RE` (income tax, CPP/QPP, EI, FICA, Medicare, CIT) into `tax` and the remainder into `deductions`.
     - If itemized reconciliation does not match and `tax + deductions > gross - net`, clears whichever single field exceeds `gross - net` instead of propagating an impossible amount.
   - Defaulted `AppConfig.VISION_MODEL_NAME` (`backend/src/config.py`), `.env.example`, and `docker-compose.yml` to `qwen3-vl:4b-instruct`.

```python
# backend/src/paycheques/parsers.py (_reconcile_vision_withholdings)
expected = gross_c - net_c
if (tax_c is not None or ded_c is not None) and abs(
    (tax_c or 0) + (ded_c or 0) - expected
) <= 1:
    return tax, deductions

# When itemized withholdings sum to gross - net (within 1 cent), partition in exact cents:
tax_sum = sum(c for lbl, c in parsed_items if _STATUTORY_TAX_RE.search(lbl))
ded_sum = sum(c for _, c in parsed_items) - tax_sum
```

## Why This Works
- **Separates perception from arithmetic:** Small 4B non-thinking VLMs accurately transcribe printed line items (`Federal Tax 190.83`, `EI 28.00`, `CPP 93.55`) when they do not have to sum decimals mentally, and exact integer-cent math in Python (`parse_cents`) guarantees penny-accurate reconciliation only when the items genuinely explain `gross - net`.
- **Handles custom PDF font encodings without vendor-specific regexes:** Escalating warning-bearing or CID-corrupted `pdf_text` to rendered images solves missing decimal points and graphic-only logos (`Softchoice`) across both `local` (Vision AI) and `docker` (RapidOCR) runtimes without adding brittle ADP-only string parsers.
- **Preserves fast paths and unit-test compatibility:** Clean PDFs never pay image-rendering latency, and gating Docker-mode RapidOCR escalation on `has_cid_garbage` or `_BROKEN_MONEY_RE` keeps unlabeled text-PDF LLM fallback tests (such as `test_peoplesoft_paystub_tables_known_sources_and_llm_guard` in `backend/test_app.py`) working unchanged.

## Prevention
- Do not treat `len(text) >= 20` as proof that embedded PDF text is valid; verify deterministic extraction succeeds without warnings before skipping image-based fallbacks.
- Keep `VISION_PROMPT` concise with a single `withholdings` list rather than separate `tax_items`/`deduction_items` fields, and avoid mentioning "Federal/Provincial" in tax instructions so 4B models do not pull `Exemptions/Allowances` rows.
- Keep `MAX_VISION_IMAGE_PX` at `1280` or higher when parsing full-page paystubs with small header text, and treat `qwen3-vl:4b-instruct` as the minimum reliable local Ollama vision model (`2b` misreads YTD columns).
- Use the persisted import pipeline logs (`/paycheques/logs` and `GET /api/paycheques/import-logs/{log_id}`) to inspect `pdf_extract` diagnostics and previews (`text_preview` with CID glyphs stripped, `raw_text_len`, `has_cid_garbage`) alongside raw `vision_extract` outputs whenever onboarding a new payroll template or testing a smaller model.
- Maintain `test_corrupted_adp_pdf_escalates_to_vision_and_reconciles_withholdings` in `backend/test_app.py` to guard both local Vision escalation + withholding reconciliation and Docker-mode CID-to-RapidOCR fallback.

## Related Issues
- `features/superiror_import_specification_v2.md` (vision preprocessing and hybrid ingestion design).
- GitHub issue search skipped (`gh` CLI not installed in this environment); no prior docs existed under `docs/solutions/`.
