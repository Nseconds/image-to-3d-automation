# n8n Workflow Configuration

This directory contains the n8n workflow definitions for the AI Text-to-3D Asset Prep Pipeline.

## Directory Structure

- **`workflow/openrouter-to-asset-workflow/ai-3d-generator-to-3d-workflow.json`**: The exported JSON workflow ready for import.

## How to Import & Configure

1. Start your local n8n container via Docker Compose (`docker-compose up`).
2. Log into n8n at `http://localhost:5678`.
3. Click on **Workflows** -> **Add Workflow** -> click the three dots menu (top-right) -> select **Import from File**.
4. Choose `ai-3d-generator-to-3d-workflow.json`.
5. Ensure the following environment variables are supplied to n8n (configured in `docker-compose.yml` or Render environment settings):
   - `OPENROUTER_API_KEY`: OpenRouter bearer key.
   - `GEMINI_API_KEY`: Google Gemini Key.
   - `STORAGE_BUCKET`: Target S3 bucket name.
6. Save and set the workflow to **Active**.
