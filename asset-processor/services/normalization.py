from PIL import Image, ImageOps

def normalize_png(image: Image.Image, max_size: int = 1024) -> Image.Image:
    """
    Standardizes image orientation, format (8-bit RGBA), removes metadata, 
    and downsizes to a maximum bounding dimension.
    """
    # 1. Standardize EXIF orientation (handles rotated mobile device uploads)
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass

    # 2. Convert to RGBA (Red, Green, Blue, Alpha) 8-bit channel format
    if image.mode != "RGBA":
        image = image.convert("RGBA")
        
    # 3. Resize if the dimensions exceed max_size, maintaining aspect ratio
    width, height = image.size
    if width > max_size or height > max_size:
        if width > height:
            new_width = max_size
            new_height = int(height * (max_size / width))
        else:
            new_height = max_size
            new_width = int(width * (max_size / height))
            
        # Use Resampling.LANCZOS for maximum quality downsizing
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
    return image
