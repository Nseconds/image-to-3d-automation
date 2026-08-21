from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import os
import uvicorn

from services import remove_background, crop_to_content, pad_to_square, normalize_png

app = FastAPI(
    title="AI Asset Processor", 
    description="FastAPI microservice for image-to-3d asset preparation (background removal, crop, padding, normalization)"
)

# Enable CORS for frontend and service integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """
    Simple liveness check.
    """
    return {"status": "ok", "service": "asset-processor"}

@app.post("/process")
async def process_image(
    image: UploadFile = File(...),
    padding_margin: float = Form(0.05),
    max_dimension: int = Form(1024),
    remove_bg: bool = Form(True)
):
    """
    Processes an input image:
    1. Normalizes colors/size.
    2. Removes background (optional, defaults to True).
    3. Crops transparent edges tightly.
    4. Centers and pads image into a transparent square.
    5. Returns the processed PNG stream.
    """
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image.")
        
    try:
        # Read uploaded image bytes
        image_bytes = await image.read()
        pil_img = Image.open(io.BytesIO(image_bytes))
        
        # Step 1: Initial normalization (EXIF rotation, max size check)
        pil_img = normalize_png(pil_img, max_size=max_dimension)
        
        # Step 2: Background removal (rembg)
        if remove_bg:
            pil_img = remove_background(pil_img)
            
        # Step 3: Crop transparent edges
        pil_img = crop_to_content(pil_img)
        
        # Step 4: Center and pad to square
        pil_img = pad_to_square(pil_img, margin=padding_margin)
        
        # Save output to bytes buffer
        output_buffer = io.BytesIO()
        pil_img.save(output_buffer, format="PNG")
        output_buffer.seek(0)
        
        return StreamingResponse(
            output_buffer, 
            media_type="image/png",
            headers={"Content-Disposition": f"inline; filename=\"processed_{image.filename}\""}
        )
        
    except Exception as e:
        print(f"[process] error during pipeline execution: {e}")
        raise HTTPException(status_code=500, detail=f"Asset processing failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
