FROM python:3.11-slim

# Install system dependencies for OpenCV, PIL, and model downloads
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the u2net_thin model so the first API call is instant
RUN mkdir -p /root/.u2net && \
    curl -L -o /root/.u2net/u2net_thin.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_thin.onnx

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
