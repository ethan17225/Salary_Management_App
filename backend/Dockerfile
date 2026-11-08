FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir .
COPY src ./src
ENV DB_PATH=/data/salary.db PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8000
CMD ["fastapi", "run", "src/main.py", "--host", "0.0.0.0", "--port", "8000"]
