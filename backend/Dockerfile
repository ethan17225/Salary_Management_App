FROM python:3.13-slim
WORKDIR /app
COPY app.py ./
ENV DB_PATH=/data/salary.db PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8000
CMD ["python", "app.py"]

