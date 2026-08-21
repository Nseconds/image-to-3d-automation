from PIL import Image

def pad_to_square(image: Image.Image, margin: float = 0.05) -> Image.Image:
    """
    Centers the image in a transparent square container with a safety margin.
    
    Args:
        image: A PIL Image (assumed to be cropped tightly).
        margin: The percentage of space to leave as padding on all sides (e.g. 0.05 = 5%).
    
    Returns:
        A new square PIL Image with the content centered and padded.
    """
    if image.mode != "RGBA":
        image = image.convert("RGBA")
        
    width, height = image.size
    max_dim = max(width, height)
    
    # Determine the size of the square canvas.
    # The bounding box max_dim should represent (100% - 2 * margin) of the square's dimension.
    usable_ratio = 1.0 - (2.0 * margin)
    if usable_ratio <= 0.1:
        usable_ratio = 0.9  # Safe fallback if margin is too large
        
    square_dim = int(max_dim / usable_ratio)
    
    # Create the transparent square canvas
    square_canvas = Image.new("RGBA", (square_dim, square_dim), (0, 0, 0, 0))
    
    # Calculate centered position offsets
    x_offset = (square_dim - width) // 2
    y_offset = (square_dim - height) // 2
    
    # Paste original image onto canvas, using its own alpha channel as a mask
    square_canvas.paste(image, (x_offset, y_offset), image)
    
    return square_canvas
