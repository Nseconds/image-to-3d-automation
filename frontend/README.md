# 3D Asset Generator Frontend

A Next.js application built with TypeScript, standard CSS modules, and a premium glassmorphic dark theme. It drives the AI Text-to-3D asset pipeline by invoking the n8n webhook and rendering live statuses, raw generated images, and processed assets.

## Features

- **Prompt Input & Control Panel:** Submit textual ideas (e.g., "a futuristic robot") to generate assets.
- **Dynamic Status Updates:** Visual progress indicator displaying pipeline stages (Prompt Refinement, Gemini Image Generation, FastAPI Background Removal, S3 Upload).
- **Comparison Viewer:** A premium dual-panel viewport showcasing the raw image side-by-side with the cropped/transparent sRGB normalized PNG.
- **Direct Asset Download:** Clickable CTA download button for the prepared PNG.
- **Image-to-3D Call to Action:** Explanatory modal and direct button to navigate to `image-to-3d.ai` playground and upload the asset.

## Environment Variables

- `NEXT_PUBLIC_N8N_WEBHOOK_URL`: The full URL of the active n8n webhook (e.g., `http://localhost:5678/webhook/generate-3d-asset` or your deployed n8n webhook).

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser.
