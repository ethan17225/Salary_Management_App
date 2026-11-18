FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir . \
    && useradd --create-home --shell /sbin/nologin appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data
ENV DB_PATH=/data/salary.db PYTHONUNBUFFERED=1
USER appuser
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"]
CMD ["fastapi", "run", "src/main.py", "--host", "0.0.0.0", "--port", "8000"]
