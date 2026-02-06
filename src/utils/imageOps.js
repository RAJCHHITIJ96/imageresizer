export const ASPECT_RATIOS = {
    "4:5": { width: 1080, height: 1350, label: "Insta Portrait (4:5)" },
    "1:1": { width: 1080, height: 1080, label: "Square (1:1)" },
    "16:9": { width: 1920, height: 1080, label: "Landscape (16:9)" },
    "9:16": { width: 1080, height: 1920, label: "Story (9:16)" },
    "LinkedIn": { width: 1080, height: 1350, label: "LinkedIn (4:5)" }
};

// Export Resolution Presets
export const EXPORT_RESOLUTIONS = {
    "HD": { multiplier: 1, label: "HD (1080p)", description: "Standard quality" },
    "2K": { multiplier: 2560 / 1080, label: "2K (1440p)", description: "High quality" },
    "4K": { multiplier: 3840 / 1080, label: "4K (2160p)", description: "Ultra quality" }
};

// Smart Compression Presets - Reduces file size while maintaining visual quality
export const COMPRESSION_PRESETS = {
    "max": { quality: 0.95, label: "Maximum", description: "Highest quality, larger file" },
    "high": { quality: 0.88, label: "High", description: "Excellent quality, balanced size" },
    "balanced": { quality: 0.80, label: "Balanced", description: "Great quality, smaller file" },
    "optimized": { quality: 0.72, label: "Optimized", description: "Good quality, much smaller file" }
};

export const processImage = async (file, formatId, mode = 'contain', blurStrength = 20) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const target = ASPECT_RATIOS[formatId] || ASPECT_RATIOS["4:5"];
                const canvas = document.createElement('canvas');
                canvas.width = target.width;
                canvas.height = target.height;
                const ctx = canvas.getContext('2d');

                // Fill background
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const fitWidth = img.width * scale;
                const fitHeight = img.height * scale;

                if (mode === 'contain') {
                    // 1. Draw blurred background
                    ctx.save();
                    const coverScale = Math.max(canvas.width / img.width, canvas.height / img.height);
                    const bgW = img.width * coverScale;
                    const bgH = img.height * coverScale;
                    const bgX = (canvas.width - bgW) / 2;
                    const bgY = (canvas.height - bgH) / 2;

                    ctx.filter = `blur(${blurStrength}px) brightness(0.7)`;
                    ctx.drawImage(img, bgX, bgY, bgW, bgH);
                    ctx.restore();

                    // 2. Draw main image
                    const x = (canvas.width - fitWidth) / 2;
                    const y = (canvas.height - fitHeight) / 2;

                    ctx.shadowColor = "rgba(0,0,0,0.5)";
                    ctx.shadowBlur = 20;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 10;

                    ctx.drawImage(img, x, y, fitWidth, fitHeight);
                } else if (mode === 'stretch') {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                } else {
                    const coverScale = Math.max(canvas.width / img.width, canvas.height / img.height);
                    const cx = (canvas.width - img.width * coverScale) / 2;
                    const cy = (canvas.height - img.height * coverScale) / 2;

                    ctx.drawImage(img, cx, cy, img.width * coverScale, img.height * coverScale);
                }

                canvas.toBlob((blob) => {
                    resolve({
                        blob,
                        name: file.name,
                        preview: URL.createObjectURL(blob),
                        canvas, // Store canvas for later export processing
                        originalWidth: target.width,
                        originalHeight: target.height
                    });
                }, 'image/jpeg', 0.95);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Export with resolution upscaling and compression
export const exportWithSettings = async (processedImage, resolution = 'HD', compression = 'high') => {
    return new Promise((resolve) => {
        const resConfig = EXPORT_RESOLUTIONS[resolution] || EXPORT_RESOLUTIONS['HD'];
        const compConfig = COMPRESSION_PRESETS[compression] || COMPRESSION_PRESETS['high'];

        // Load the preview image
        const img = new Image();
        img.onload = () => {
            // Calculate new dimensions
            const newWidth = Math.round(processedImage.originalWidth * resConfig.multiplier);
            const newHeight = Math.round(processedImage.originalHeight * resConfig.multiplier);

            // Create high-res canvas
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');

            // Enable image smoothing for quality upscaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Draw scaled image
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Export with compression setting
            canvas.toBlob((blob) => {
                const sizeKB = Math.round(blob.size / 1024);
                const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                resolve({
                    blob,
                    name: processedImage.name,
                    width: newWidth,
                    height: newHeight,
                    sizeKB,
                    sizeMB,
                    quality: compConfig.quality,
                    resolution: resolution
                });
            }, 'image/jpeg', compConfig.quality);
        };
        img.src = processedImage.preview;
    });
};

// Batch export all images with settings - PRESERVES ORDER with index
export const batchExport = async (processedImages, resolution = 'HD', compression = 'high') => {
    // Process all images and preserve order with explicit index
    const results = await Promise.all(
        processedImages.map(async (img, index) => {
            const result = await exportWithSettings(img, resolution, compression);
            return {
                ...result,
                orderIndex: index, // Explicit order index (0-based)
                sequenceNumber: index + 1 // Human-readable sequence (1-based)
            };
        })
    );

    // Sort by orderIndex to guarantee order (even though Promise.all preserves order, this is extra safety)
    return results.sort((a, b) => a.orderIndex - b.orderIndex);
};

// Calculate estimated file size (for UI preview)
export const estimateFileSize = (originalSize, resolution, compression) => {
    const resConfig = EXPORT_RESOLUTIONS[resolution] || EXPORT_RESOLUTIONS['HD'];
    const compConfig = COMPRESSION_PRESETS[compression] || COMPRESSION_PRESETS['high'];

    // Resolution affects size quadratically, compression linearly
    const resolutionFactor = resConfig.multiplier * resConfig.multiplier;
    const compressionFactor = compConfig.quality;

    // Rough estimation based on typical JPEG behavior
    const estimated = originalSize * resolutionFactor * (compressionFactor / 0.95);
    return Math.round(estimated);
};
