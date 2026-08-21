from PIL import Image

def crop_to_content(image: Image.Image) -> Image.Image:
    """
    Crops the image to its non-transparent bounding box (alpha channel > 0).
    If the image is completely transparent or has no alpha channel, it returns the input image.
    """
    # Ensure image has alpha channel to check transparency
    if image.mode != "RGBA":
        image = image.convert("RGBA")
        
    bbox = image.getbbox()
    if bbox:
        # Crops to (left, upper, right, lower)
        return image.crop(bbox)
    
    return image
