FROM python:3.11-slim

WORKDIR /app

# CPU-only PyTorch (Render has no GPU; keeps image smaller than default CUDA wheels)
RUN pip install --no-cache-dir torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY main.py /app/main.py

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

# CLIP cold start can take several minutes on first deploy
HEALTHCHECK --interval=30s --timeout=15s --start-period=600s --retries=5 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/health', timeout=10)"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
