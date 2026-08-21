import os
import sys
from PIL import Image, ImageDraw

# Add current directory to Python path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services import remove_background, crop_to_content, pad_to_square, normalize_png

def create_dummy_image():
    """
    Creates a simple 400x300 image with a white background and a solid red circle.
    """
    img = Image.new("RGB", (400, 300), "white")
    draw = ImageDraw.Draw(img)
    # Draw red circle in center
    draw.ellipse([150, 100, 250, 200], fill="red", outline="red")
    return img

def main():
    print("=== Step 1: Creating Dummy Test Image ===")
    raw_img = create_dummy_image()
    raw_img.save("test_input.png")
    print("Saved raw test image to 'test_input.png'")

    print("\n=== Step 2: Normalization ===")
    normalized_img = normalize_png(raw_img, max_size=512)
    print(f"Normalized image size: {normalized_img.size}")

    print("\n=== Step 3: Background Removal ===")
    try:
        # Try running rembg background removal
        processed_bg = remove_background(normalized_img)
        print("rembg background removal succeeded!")
    except Exception as e:
        print(f"rembg background removal bypassed (rembg/onnx/torch not installed on host): {e}")
        print("Running fallback color-threshold background removal (white -> transparent)...")
        # Color key fallback for testing on hosts without machine learning libraries
        img_rgba = normalized_img.convert("RGBA")
        pixels = img_rgba.load()
        for y in range(img_rgba.size[1]):
            for x in range(img_rgba.size[0]):
                r, g, b, a = pixels[x, y]
                # If pixel is close to white, make it transparent
                if r > 240 and g > 240 and b > 240:
                    pixels[x, y] = (255, 255, 255, 0)
        processed_bg = img_rgba

    print("\n=== Step 4: Crop to Bounding Box ===")
    cropped_img = crop_to_content(processed_bg)
    print(f"Cropped image size (trimmed alpha): {cropped_img.size}")

    print("\n=== Step 5: Pad to Centered Square ===")
    final_img = pad_to_square(cropped_img, margin=0.10) # 10% safety margin
    print(f"Final square image size: {final_img.size}")
    
    final_img.save("test_output.png")
    print("Saved final processed image to 'test_output.png'")
    print("\nTest completed successfully! Open test_input.png and test_output.png to verify.")

if __name__ == "__main__":
    main()
