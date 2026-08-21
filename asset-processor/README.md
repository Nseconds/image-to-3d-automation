# Asset Processor Service

A FastAPI microservice that processes raw generated images to make them suitable for 3D asset generation.

## Features

- **Background Removal:** Uses the local `rembg` library with the `u2net_thin` model (pre-downloaded in Docker).
- **Subject Auto-Cropping:** Trims empty transparent margins around the generated subject.
- **Square Normalization & Padding:** Centers the subject on a square, transparent canvas with a customizable safety margin (e.g. 5%) to avoid edge clipping in 3D algorithms.
- **Format Normalization:** Standardizes files to 8-bit sRGB RGBA PNG format.

## API Endpoints

### 1. Health Check
`GET /health`

**Response:**
```json
{
  "status": "ok",
  "service": "asset-processor"
}
```

### 2. Process Image
`POST /process`

- Accepts a multipart form-data file under the key `image`.
- **Form Parameters (Optional):**
  - `padding_margin`: Float, defaults to `0.05` (5% padding on all sides).
  - `max_dimension`: Integer, defaults to `1024` (downscales larger images to 1024x1024 max).
  - `remove_bg`: Boolean, defaults to `true` (performs background removal if true).

**Response:**
Streams the processed `.png` file.

---

## Local Setup

### Prerequisite: Python 3.10+

1. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the service locally:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Running with Docker

Build and run:
```bash
docker build -t asset-processor .
docker run -p 8000:8000 asset-processor
```
