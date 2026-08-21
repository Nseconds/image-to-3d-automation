# AI Text-to-3D Asset Generator Pipeline

This repository contains the complete ecosystem for generating, processing, and preparing 2D images from natural language text to be used in 3D asset generation (such as `image-to-3d.ai`).

## System Architecture

```
[ User Text Idea ]
        │
        ▼ (Webhook Trigger)
   [ n8n Workflow ]
   ├── 1. Refine Prompt (OpenRouter Llama-3)
   ├── 2. Generate Image (Google Gemini API)
   ├── 3. Process Image (FastAPI Asset Processor)
   └── 4. Store Assets (MinIO / AWS S3)
        │
        ▼ (Returns Webhook Response)
  [ Next.js Web UI ] ───► [ User Downloads PNG ] ───► [ Manual Upload to image-to-3d.ai ] ───► [ User Gets GLB Model ]
```

## Directory Structure

- **[frontend/](file:///c:/Users/Synosys/Desktop/project3d/ai-3d-generator/frontend/)**: Next.js App Router Web UI (TypeScript, glassmorphic dark theme, progress indicator, side-by-side comparative viewport).
- **[asset-processor/](file:///c:/Users/Synosys/Desktop/project3d/ai-3d-generator/asset-processor/)**: FastAPI service that performs background removal (`rembg` via `u2net_thin`), cropping transparent margins, centered square padding, and sRGB normalization.
- **[n8n/](file:///c:/Users/Synosys/Desktop/project3d/ai-3d-generator/n8n/)**: Holds n8n configuration, README, and the workflow export JSON.

---

## Environment Variables

Create a `.env` file in the root directory (copied from below) to supply your API credentials:

```bash
# API Keys (Required for n8n execution)
OPENROUTER_API_KEY=your_openrouter_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Object Storage Bucket Name
STORAGE_BUCKET=assets
```

---

## Local Development (Docker Compose)

The easiest way to run the entire system locally is using Docker Compose:

1. Clone or copy this repository.
2. In the root directory, run:
   ```bash
   docker-compose up --build
   ```
3. This spins up the following services:
   - **Next.js Frontend:** [http://localhost:3000](http://localhost:3000)
   - **n8n Workflow Editor:** [http://localhost:5678](http://localhost:5678)
   - **FastAPI Asset Processor:** [http://localhost:8000](http://localhost:8000)
   - **MinIO S3 Object Storage:** [http://localhost:9000](http://localhost:9000) (Console at [http://localhost:9001](http://localhost:9001))
   - **PostgreSQL Database:** Port `5432` (Backing store for n8n)

### Importing the n8n Workflow

1. Open n8n console at `http://localhost:5678`.
2. Set up your admin account on first run.
3. Create a new workflow, click the top-right menu (three dots), choose **Import from file**, and select [ai-3d-generator-to-3d-workflow.json](file:///c:/Users/Synosys/Desktop/project3d/ai-3d-generator/n8n/workflow/openrouter-to-asset-workflow/ai-3d-generator-to-3d-workflow.json).
4. Fill in credentials or ensure the S3 node matches the Docker MinIO defaults.
5. Click **Save** and toggle the workflow **Active**.

---

## Production Deployment (Render)

Deploy the services to Render using the included [render.yaml](file:///c:/Users/Synosys/Desktop/project3d/ai-3d-generator/render.yaml) Blueprint:

1. Push this repository to GitHub or GitLab.
2. Go to the Render Dashboard, click **New +**, and choose **Blueprint**.
3. Select your repository. Render will automatically detect the `render.yaml` file.
4. Input the required environment variables:
   - `OPENROUTER_API_KEY`
   - `GEMINI_API_KEY`
   - `STORAGE_BUCKET` (your AWS S3 or Cloudflare R2 bucket name)
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
   - `S3_PUBLIC_URL` (the public gateway URL of your S3 bucket)
5. Click **Approve**. Render will provision PostgreSQL, n8n, FastAPI, and Next.js, wiring them together automatically!
