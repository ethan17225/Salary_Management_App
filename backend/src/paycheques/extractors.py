"""CPU-bound text extraction, always called through asyncio.to_thread.

OCR (rapidocr) and the local LLM (llama-cpp-python + Qwen2.5-0.5B GGUF) come from the optional
`ocr` extra and are imported lazily, so the API runs without them and degrades gracefully."""

import io
import json
import os
import re
import statistics
import threading
from functools import cache
from importlib.util import find_spec
from pathlib import Path

import pdfplumber

from src.config import settings

MAX_PDF_TEXT_PAGES = 5
MAX_OCR_PAGES = 2
MAX_OCR_IMAGE_PX = 1800
OCR_PDF_SCALE = 1.75
MAX_LLM_CHARS = 1800


def pdf_extract(content: bytes) -> tuple[str, list[list[list[str | None]]]]:
    texts: list[str] = []
    tables: list[list[list[str | None]]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages[:MAX_PDF_TEXT_PAGES]:
            texts.append(page.extract_text() or "")
            tables.extend(page.extract_tables() or [])
    return "\n".join(texts).strip(), tables


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


def ocr_text(content: bytes, mime: str) -> tuple[str, float]:
    """Returns (text, mean OCR score)."""
    import numpy as np
    from PIL import Image

    if mime == "application/pdf":
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(content)
        try:
            images = [
                pdf[i].render(scale=OCR_PDF_SCALE).to_pil()
                for i in range(min(len(pdf), MAX_OCR_PAGES))
            ]
        finally:
            pdf.close()
    else:
        images = [Image.open(io.BytesIO(content))]

    lines: list[str] = []
    scores: list[float] = []
    for img in images:
        rgb = img.convert("RGB")
        if max(rgb.size) > MAX_OCR_IMAGE_PX:
            rgb.thumbnail((MAX_OCR_IMAGE_PX, MAX_OCR_IMAGE_PX), Image.Resampling.LANCZOS)
        out = _ocr_engine()(np.array(rgb))
        if out.boxes is None or not len(out.boxes):
            continue
        lines += _visual_lines(out.boxes.tolist(), out.txts)
        scores += [float(s) for s in out.scores]
    return "\n".join(lines), (sum(scores) / len(scores) if scores else 0.0)


# --- Local LLM fallback ------------------------------------------------------------------

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
_LLM_KEEP_RE = re.compile(
    r"\d+\.\d{2}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}"
    r"|\b(?:gross|net|tax|deduct|pay|advice|cheque|check|current|total|earnings|deposit|hours)\b",
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


def llm_extract(text: str) -> dict:
    with _LLM_LOCK:
        res = _llm().create_chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Paystub text:\n{_compact_for_llm(text)}"},
            ],
            response_format={"type": "json_object", "schema": PAYSTUB_JSON_SCHEMA},
            temperature=0.0,
            max_tokens=140,
        )
    data = json.loads(res["choices"][0]["message"]["content"])
    return data if isinstance(data, dict) else {}
