FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi>=0.109.0 \
    uvicorn>=0.27.0 \
    sentence-transformers>=2.2.2 \
    pydantic>=2.5.0

COPY reranker_service.py .

EXPOSE 8001

CMD ["uvicorn", "reranker_service:app", "--host", "0.0.0.0", "--port", "8001"]
