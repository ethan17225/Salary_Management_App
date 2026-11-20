# Stage 1: build wheels. llama-cpp-python compiles from source; keep the compiler out of runtime.
FROM python:3.13-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY pyproject.toml ./
# Only dependencies are installed (the app runs from /app/src), so src edits never rebuild wheels.
RUN python -c "import tomllib; p = tomllib.load(open('pyproject.toml', 'rb'))['project']; \
print('\n'.join(p['dependencies'] + p['optional-dependencies']['ocr']))" > requirements.txt \
    && CMAKE_BUILD_PARALLEL_LEVEL=8 pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Stage 2: lean non-root runtime
FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
# Qwen2.5-0.5B-Instruct Q4_K_M (~490 MB). Pinned by checksum, so rebuilds reuse the cached layer.
ADD --checksum=sha256:74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db --chmod=644 \
    https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf \
    /opt/models/qwen2.5-0.5b-instruct-q4_k_m.gguf
WORKDIR /app
RUN --mount=type=bind,from=builder,source=/wheels,target=/wheels \
    --mount=type=bind,from=builder,source=/build/requirements.txt,target=/tmp/requirements.txt \
    pip install --no-cache-dir --no-index --find-links /wheels -r /tmp/requirements.txt \
    && python -c "from rapidocr import RapidOCR; RapidOCR()" \
    && useradd --create-home --shell /sbin/nologin appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data
RUN chmod 755 /opt/models
COPY --chown=appuser:appuser src ./src
ENV DB_PATH=/data/salary.db PYTHONUNBUFFERED=1
USER appuser
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"]
CMD ["fastapi", "run", "src/main.py", "--host", "0.0.0.0", "--port", "8000"]
