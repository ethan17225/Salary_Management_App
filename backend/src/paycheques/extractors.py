"""CPU-bound text/image extraction and optional OpenAI-compatible Vision OCR client.

RapidOCR and llama-cpp-python come from the optional `ocr` extra and are imported lazily so
local dev/test runs without C++ or ONNX runtimes degrade gracefully."""

import asyncio
import base64
import io
import json
import os
import re
import statistics
import threading
from collections.abc import Sequence
from functools import cache
from importlib.util import find_spec
from pathlib import Path

import pdfplumber

from src.config import settings

MAX_PDF_TEXT_PAGES = 15
MAX_OCR_PAGES = 5
MAX_OCR_IMAGE_PX = 1800
MAX_VISION_IMAGE_PX = 1280
OCR_PDF_SCALE = 1.75
MAX_LLM_CHARS = 1800


def pdf_extract(content: bytes) -> tuple[str, list[list[list[str | None]]]]:
    texts: list[str] = []
    tables: list[list[list[str | None]]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages[:MAX_PDF_TEXT_PAGES]:
            texts.append(page.extract_text() or "")
            tables.extend(page.extract_tables() or [])
    return "\n\f\n".join(texts).strip(), tables


def _is_dark_background(gray) -> tuple[bool, float, float]:
    import numpy as np

    h, w = gray.shape
    pad_y, pad_x = max(1, h // 20), max(1, w // 20)
    border = np.concatenate(
        [
            gray[:pad_y, :].ravel(),
            gray[-pad_y:, :].ravel(),
            gray[pad_y:-pad_y, :pad_x].ravel(),
            gray[pad_y:-pad_y, -pad_x:].ravel(),
        ]
    )
    center = gray[h // 5 : h - h // 5, w // 5 : w - w // 5]
    border_med = float(np.median(border))
    center_med = float(np.median(center)) if center.size else border_med
    return (border_med < 175.0 and (center_med - border_med) >= 20.0), border_med, center_med


def _auto_crop_paper(rgb, border_med: float, center_med: float):
    import numpy as np

    h, w = rgb.shape[:2]
    try:
        import cv2
    except ImportError:
        cv2 = None

    if cv2 is not None:
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            area_ratio = cv2.contourArea(largest) / float(h * w)
            if 0.15 <= area_ratio <= 0.92:
                x, y, cw, ch = cv2.boundingRect(largest)
                pad = int(min(cw, ch) * 0.02)
                return rgb[
                    max(0, y - pad) : min(h, y + ch + pad),
                    max(0, x - pad) : min(w, x + cw + pad),
                ]
        return rgb

    mask = rgb.mean(axis=2) > (border_med + center_med) / 2.0
    ys, xs = np.where(mask)
    if ys.size:
        y1, y2 = int(ys.min()), int(ys.max()) + 1
        x1, x2 = int(xs.min()), int(xs.max()) + 1
        area_ratio = ((y2 - y1) * (x2 - x1)) / float(h * w)
        if 0.15 <= area_ratio <= 0.92:
            pad = int(min(y2 - y1, x2 - x1) * 0.02)
            return rgb[max(0, y1 - pad) : min(h, y2 + pad), max(0, x1 - pad) : min(w, x2 + pad)]
    return rgb


def _enhance_ink_contrast(rgb):
    try:
        import cv2
    except ImportError:
        return rgb
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l_chan, a_chan, b_chan = cv2.split(lab)
    l_enhanced = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l_chan)
    return cv2.cvtColor(cv2.merge((l_enhanced, a_chan, b_chan)), cv2.COLOR_LAB2RGB)


def preprocess_document_image(image, max_dim: int = MAX_OCR_IMAGE_PX):
    """EXIF-orient, auto-crop bright cheques off dark backgrounds with CLAHE, and downscale."""
    import numpy as np
    from PIL import Image, ImageOps

    img = ImageOps.exif_transpose(image).convert("RGB")
    dark_bg, border_med, center_med = _is_dark_background(np.array(img.convert("L")))
    if dark_bg:
        rgb = np.array(img)
        cropped = _auto_crop_paper(rgb, border_med, center_med)
        img = Image.fromarray(_enhance_ink_contrast(cropped))
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    return img


def prepare_images(content: bytes, mime: str, max_dim: int = MAX_OCR_IMAGE_PX) -> list:
    from PIL import Image

    if mime == "application/pdf":
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(content)
        try:
            raw_images = [
                pdf[i].render(scale=OCR_PDF_SCALE).to_pil()
                for i in range(min(len(pdf), MAX_OCR_PAGES))
            ]
        finally:
            pdf.close()
    else:
        with Image.open(io.BytesIO(content)) as opened:
            raw_images = [opened.copy()]
    return [preprocess_document_image(img, max_dim=max_dim) for img in raw_images]


@cache
def _ocr_engine():
    from rapidocr import RapidOCR

    return RapidOCR()


def _visual_lines(boxes, txts) -> list[str]:
    """Group OCR boxes into visual rows (top-to-bottom, then left-to-right) so a line like
    'Net pay  1,842.50  24,000.00' keeps Current before YTD."""
    tolerance = max(8.0, statistics.median(b[3][1] - b[0][1] for b in boxes) / 2)
    rows: list[list[tuple[float, float, str]]] = []
    for y, x, text in sorted((b[0][1], b[0][0], t) for b, t in zip(boxes, txts, strict=True)):
        if rows and y - rows[-1][0][0] <= tolerance:
            rows[-1].append((y, x, text))
        else:
            rows.append([(y, x, text)])
    return ["  ".join(t for _, _, t in sorted(r, key=lambda i: i[1])) for r in rows]


def ocr_text(content: bytes, mime: str, images: list | None = None) -> tuple[str, float]:
    """Returns (text, mean OCR score)."""
    import numpy as np

    imgs = images if images is not None else prepare_images(content, mime)
    pages: list[str] = []
    scores: list[float] = []
    for img in imgs:
        out = _ocr_engine()(np.array(img.convert("RGB")))
        if out.boxes is None or not len(out.boxes):
            continue
        pages.append("\n".join(_visual_lines(out.boxes.tolist(), out.txts)))
        scores += [float(s) for s in out.scores]
    return "\n\f\n".join(pages), (sum(scores) / len(scores) if scores else 0.0)


# --- Optional OpenAI-compatible Vision OCR (GLM-OCR / Qwen3.5 / llama-server) -----------

VISION_PROMPT = (
    'Classify the image as "cheque" (shows PAY TO THE ORDER OF or /100 DOLLARS), '
    '"deposit" (Interac e-Transfer, banking deposit screenshot, or CRA/government benefit notice), '
    'or "paystub", then extract income fields as ONLY valid JSON:\n'
    '{"document_type":"cheque"|"deposit"|"paystub","source_name":string|null,'
    '"paid_on":"YYYY-MM-DD"|null,"numeric_amount":"0.00"|null,'
    '"written_amount":"0.00"|null,"gross":"0.00"|null,"tax":"0.00"|null,'
    '"deductions":"0.00"|null,"withholdings":[{"label":string,"amount":"0.00"}],'
    '"hours":number|null,"cheque_number":string|null}\n'
    'If the image shows multiple distinct payments or statement rows, instead return '
    '{"document_type":"cheque"|"deposit"|"paystub","source_name":string|null,"entries":[{...}]} '
    "with one entry object per row using the same fields.\n"
    "- source_name: employer, payer trade/brand name, e-Transfer sender, or 'CRA / Government' "
    "(ignore numbered corps like '5024721 ONTARIO LIMITED' when a trade name is visible).\n"
    '- For cheques: numeric_amount = "$" box (superscript cents like 611^86 -> "611.86"); '
    'written_amount = spelled-out legal line ("611.86" or verbatim words); '
    "paid_on = YYYY-MM-DD (Nov 20 / 26 -> 2026-11-20); "
    "NEVER use company IDs, cheque numbers, or MICR digits as amounts; "
    "set gross, tax, deductions, hours to null and withholdings to [].\n"
    "- For deposits (Interac e-Transfer / bank deposit / CRA benefit): "
    "source_name = sender or 'CRA / Government'; "
    "paid_on = deposit/transfer/issue date as YYYY-MM-DD; "
    "numeric_amount = deposited/received amount; written_amount = null; "
    "set gross, tax, deductions, hours to null and withholdings to [].\n"
    "- For paystubs: CURRENT PERIOD figures only (ignore YTD, Exemptions/Allowances, "
    "and Deposit Acct / Direct Deposit lines); "
    "paid_on = Advice Date / Pay Date / Check Date as YYYY-MM-DD (NEVER Pay Begin/End Date); "
    "numeric_amount = Net Pay; written_amount = null; "
    "tax = printed Total Taxes (or null); deductions = printed Total Deductions (or null); "
    "list individual current-period tax/statutory/deduction lines in withholdings "
    "as positive amounts."
)


def vision_available() -> bool:
    return settings.effective_vision_base_url is not None


def _encode_vision_jpeg_b64(img) -> str:
    from PIL import Image

    work = img.copy()
    if max(work.size) > MAX_VISION_IMAGE_PX:
        work.thumbnail((MAX_VISION_IMAGE_PX, MAX_VISION_IMAGE_PX), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    work.convert("RGB").save(buf, format="JPEG", quality=90, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _parse_json_object(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.I | re.S).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.S)
        data = json.loads(match.group(0)) if match else {}
    return data if isinstance(data, dict) else {}


async def vision_extract(images: list, known_sources: Sequence[str] = ()) -> dict:
    import httpx

    base_url = (settings.effective_vision_base_url or "").rstrip("/")
    prompt = VISION_PROMPT
    clean_sources = [s.strip() for s in known_sources if s.strip()][:20]
    if clean_sources:
        prompt += f"\nKnown sources (prefer an exact match if visible): {', '.join(clean_sources)}."

    content_blocks: list[dict] = []
    for img in images:
        b64 = await asyncio.to_thread(_encode_vision_jpeg_b64, img)
        content_blocks.append(
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        )
    content_blocks.append({"type": "text", "text": prompt})

    timeout = httpx.Timeout(settings.VISION_TIMEOUT_SECONDS, connect=2.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.VISION_API_KEY}"},
            json={
                "model": settings.VISION_MODEL_NAME,
                "temperature": 0.0,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "user", "content": content_blocks}],
            },
        )
        resp.raise_for_status()
    return _parse_json_object(resp.json()["choices"][0]["message"]["content"])


# --- Local LLM fallback (CPU Qwen2.5-0.5B) -----------------------------------------------

_LLM_FIELDS = ("source_name", "paid_on", "gross", "tax", "deductions", "amount", "hours")
PAYSTUB_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        key: {"type": ["number" if key == "hours" else "string", "null"]} for key in _LLM_FIELDS
    },
    "required": list(_LLM_FIELDS),
}
SYSTEM_PROMPT = (
    "Extract paystub fields into JSON. Rules:\n"
    "- Use CURRENT PERIOD figures only; ignore YTD (year-to-date) totals.\n"
    "- source_name = employer name.\n"
    "- paid_on = pay/advice/check date as YYYY-MM-DD (NOT Pay Begin/End Date).\n"
    "- gross = total pay before taxes/deductions; amount = net take-home pay (<= gross).\n"
    "- Use null when a field is not present."
)
CHEQUE_SYSTEM_PROMPT = (
    "Extract bank cheque fields into JSON. Rules:\n"
    "- source_name = payer trade name in top-left (prefer trade name over numbered corp).\n"
    "- paid_on = cheque date as YYYY-MM-DD.\n"
    "- amount = cheque dollar amount from '$' box or spelled-out dollars line.\n"
    "- NEVER use numbered company IDs (e.g. 5024721), cheque numbers, or MICR digits as amounts.\n"
    "- Always set gross, tax, deductions, and hours to null."
)
DEPOSIT_SYSTEM_PROMPT = (
    "Extract deposit, e-Transfer, or government benefit notice fields into JSON. Rules:\n"
    "- source_name = sender name or 'CRA / Government' for tax/benefit notices.\n"
    "- paid_on = deposit, transfer, or issue date as YYYY-MM-DD.\n"
    "- amount = deposited/received dollar amount.\n"
    "- Always set gross, tax, deductions, and hours to null."
)
_LLM_KEEP_RE = re.compile(
    r"\d+\.\d{2}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}"
    r"|\b(?:gross|net|tax|deduct|pay|advice|cheque|check|current|total|earnings|deposit|hours"
    r"|order|dollars|hundred|thousand)\b",
    re.I,
)
_LLM_LOCK = threading.Lock()  # llama.cpp contexts aren't thread-safe: one inference at a time


def llm_available() -> bool:
    try:
        return Path(settings.QWEN_MODEL_PATH).is_file() and find_spec("llama_cpp") is not None
    except OSError:
        return False


@cache
def _llm():
    from llama_cpp import Llama

    return Llama(
        model_path=settings.QWEN_MODEL_PATH,
        n_ctx=1536,
        n_threads=min(os.cpu_count() or 4, 4),
        n_batch=512,
        chat_format="chatml",
        verbose=False,
    )


def _compact_for_llm(text: str) -> str:
    """Keep header lines (employer + dates) and numeric/summary lines inside a small prompt."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    kept: list[str] = []
    seen: set[str] = set()
    for i, line in enumerate(lines):
        if i < 8 or _LLM_KEEP_RE.search(line):
            if line not in seen:
                seen.add(line)
                kept.append(line)
    return "\n".join(kept)[:MAX_LLM_CHARS]


def llm_extract(text: str, cheque_mode: bool = False, doc_type: str | None = None) -> dict:
    mode = doc_type or ("cheque" if cheque_mode else "paystub")
    prompt = (
        CHEQUE_SYSTEM_PROMPT
        if mode == "cheque"
        else DEPOSIT_SYSTEM_PROMPT
        if mode == "deposit"
        else SYSTEM_PROMPT
    )
    with _LLM_LOCK:
        res = _llm().create_chat_completion(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Document text:\n{_compact_for_llm(text)}"},
            ],
            response_format={"type": "json_object", "schema": PAYSTUB_JSON_SCHEMA},
            temperature=0.0,
            max_tokens=140,
        )
    return _parse_json_object(res["choices"][0]["message"]["content"])
