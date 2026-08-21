from PIL import Image
import os

# Lazy load session to avoid importing rembg at startup if not needed or not installed
session = None

def get_session():
    global session
    if session is not None:
        return session
    try:
        from rembg import new_session
        model_name = os.environ.get("REMBG_MODEL", "u2net_thin")
        session = new_session(model_name)
    except Exception as e:
        print(f"Lazy load session failed: {e}")
        session = None
    return session

def remove_background(image: Image.Image) -> Image.Image:
    """
    Removes the background from the provided PIL Image, returning an RGBA transparent image.
    Uses lazy import of rembg.
    """
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
        
    try:
        from rembg import remove
    except ImportError as e:
        raise ImportError(
            "The 'rembg' package is not installed. Please install it with 'pip install rembg[cpu]' to enable background removal."
        ) from e
        
    sess = get_session()
    processed = remove(image, session=sess)
    return processed
