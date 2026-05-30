/**
 * Client-Side Image Compressor for Tikchop.
 * Downscales images to a maximum dimension of 1080px and compresses them using JPEG at 0.8 quality.
 */
export async function compressImage(file, maxDimension = 1080, quality = 0.8) {
  // If not a standard browser environment or not an image file, return original file
  if (typeof window === "undefined" || !file || !file.type.startsWith("image/")) {
    return file;
  }

  // If the file is already small (under 200KB), don't compress
  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Apply max dimension constraint maintaining aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file); // Fallback to original
        }

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            // Create a new File from blob
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            console.log(
              `Compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(
                compressedFile.size / 1024
              ).toFixed(1)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`
            );
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => {
        resolve(file);
      };
    };

    reader.onerror = () => {
      resolve(file);
    };
  });
}
