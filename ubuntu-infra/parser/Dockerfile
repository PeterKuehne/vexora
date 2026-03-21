FROM python:3.12-slim

WORKDIR /app

# System deps for docling
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    fastapi>=0.109.0 \
    uvicorn>=0.27.0 \
    pydantic>=2.5.0 \
    markdown>=3.5.0 \
    beautifulsoup4>=4.12.0 \
    docling>=2.0.0

COPY parser_service.py .

EXPOSE 8002

CMD ["uvicorn", "parser_service:app", "--host", "0.0.0.0", "--port", "8002"]
