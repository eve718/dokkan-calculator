#!/usr/bin/env node
/**
 * Automatic OG image generator
 * 
 * This script ensures the OG image is exactly 1200×630 and optimized for web.
 * It runs automatically before obfuscation to keep the image deployment-ready.
 * 
 * Usage:
 *   1. Drop your 1200×630+ image at `images/og-image.jpg`
 *   2. Run: npm run generate-og-image
 *   3. The image is automatically cropped, resized, and optimized
 */

const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

const OG_PATH = path.join(__dirname, '../images/og-image.jpg');
const TARGET_W = 1200;
const TARGET_H = 630;
const TARGET_QUALITY = 70;

async function generateOgImage() {
  try {
    // Check if image exists
    if (!fs.existsSync(OG_PATH)) {
      console.log(`[generate-og-image] ⚠️  og-image.jpg not found at ${OG_PATH}`);
      console.log('[generate-og-image] Skipping optimization.');
      return;
    }

    const img = await Jimp.read(OG_PATH);
    const { width, height } = img.bitmap;
    console.log(`[generate-og-image] Processing: ${width}×${height}`);

    // Calculate aspect ratios
    const srcAspect = width / height;
    const targetAspect = TARGET_W / TARGET_H;

    // Crop to target aspect ratio
    let cropped;
    if (srcAspect > targetAspect) {
      // Image is too wide: crop sides
      const newW = Math.round(height * targetAspect);
      const cropX = Math.round((width - newW) / 2);
      cropped = img.crop({ x: cropX, y: 0, w: newW, h: height });
      console.log(`[generate-og-image] Cropped Width: ${width} → ${newW}`);
    } else if (srcAspect < targetAspect) {
      // Image is too tall: crop top/bottom
      const newH = Math.round(width / targetAspect);
      const cropY = Math.round((height - newH) / 2);
      cropped = img.crop({ x: 0, y: cropY, w: width, h: newH });
      console.log(`[generate-og-image] Cropped Height: ${height} → ${newH}`);
    } else {
      cropped = img;
      console.log('[generate-og-image] Aspect ratio already correct');
    }

    // Resize to exact dimensions
    cropped.resize({ w: TARGET_W, h: TARGET_H });

    // Compress and save
    const buffer = await cropped.getBuffer('image/jpeg', { quality: TARGET_QUALITY });
    fs.writeFileSync(OG_PATH, buffer);

    const sizeKB = Math.round(buffer.length / 1024);
    console.log(`[generate-og-image] ✓ Success: ${TARGET_W}×${TARGET_H}, ${sizeKB} KB`);
  } catch (error) {
    console.error('[generate-og-image] Error:', error.message);
    process.exit(1);
  }
}

generateOgImage();
