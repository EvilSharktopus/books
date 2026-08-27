import sharp from "sharp";

// Claude's base64-encoded image limit.
const CLAUDE_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Resize down to fit under Claude's base64 image limit, re-encoding as JPEG.
// Leaves already-small images untouched.
export async function prepareImageBuffer(
  buffer: Buffer<ArrayBuffer>,
  mediaType: string
): Promise<{ buffer: Buffer<ArrayBuffer>; mediaType: string }> {
  const base64Size = Math.ceil((buffer.length * 4) / 3);
  if (base64Size <= CLAUDE_MAX_IMAGE_BYTES) return { buffer, mediaType };

  const resized = await sharp(buffer)
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return { buffer: resized as Buffer<ArrayBuffer>, mediaType: "image/jpeg" };
}
