"""CPU-bound text extraction, always called through asyncio.to_thread.

OCR (rapidocr) and the local LLM (llama-cpp-python + Qwen2.5-0.5B GGUF) come from the optional
`ocr` extra and are imported lazily, so the API runs without them and degrades gracefully."""

import io
import json
import statistics
import threading
from functools import cache
from importlib.util import find_spec
from pathlib import Path

import pdfplumber

from src.config import settings

MAX_PDF_TEXT_PAGES = 5
MAX_OCR_PAGES = 2
MAX_LLM_CHARS = 4500


def pdf_text(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        return "\n".join(p.extract_text() or "" for p in pdf.pages[:MAX_PDF_TEXT_PAGES]).strip()


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
            images = [pdf[i].render(scale=2).to_pil() for i in range(min(len(pdf), MAX_OCR_PAGES))]
        finally:
            pdf.close()
    else:
        images = [Image.open(io.BytesIO(content))]

    lines: list[str] = []
    scores: list[float] = []
    for img in images:
        out = _ocr_engine()(np.array(img.convert("RGB")))
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
    "- source_name = employer. paid_on = pay date as YYYY-MM-DD.\n"
    "- gross = total pay before taxes/deductions; amount = net take-home pay (<= gross).\n"
    "- Use null when a field is not present."
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

    # n_ctx 4096: Qwen tokenizes digits one by one, so 4.5k chars of paystub can top 2k tokens.
    return Llama(
        model_path=settings.QWEN_MODEL_PATH, n_ctx=4096, chat_format="chatml", verbose=False
    )


def llm_extract(text: str) -> dict:
    with _LLM_LOCK:
        res = _llm().create_chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Paystub text:\n{text[:MAX_LLM_CHARS]}"},
            ],
            response_format={"type": "json_object", "schema": PAYSTUB_JSON_SCHEMA},
            temperature=0.0,
            max_tokens=256,
        )
    data = json.loads(res["choices"][0]["message"]["content"])
    return data if isinstance(data, dict) else {}
