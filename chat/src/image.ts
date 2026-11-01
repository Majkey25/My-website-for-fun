// Images a visitor attaches: base64 data URLs only, checked byte by byte. The browser re-encodes
// them first; these checks hold for any client.

export const MAX_IMAGE_BYTES = 1536 * 1024;
/** Bounds the model's image tokens whatever the model's resizing rules are. */
export const MAX_IMAGE_SIDE = 2048;

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

/** Width and height read from the file header, or null when the header is not what it claims. */
export function imageSize(type: string, bytes: Uint8Array): [number, number] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u24 = (at: number) => view.getUint16(at, true) | (view.getUint8(at + 2) << 16);
  // Reads past the end throw a RangeError, which means a truncated header.
  try {
    if (type === 'image/png')
      return ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n' && ascii(bytes, 12, 16) === 'IHDR'
        ? [view.getUint32(16), view.getUint32(20)]
        : null;
    if (type === 'image/webp') {
      if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') return null;
      const chunk = ascii(bytes, 12, 16);
      if (chunk === 'VP8 ')
        return u24(23) === 0x2a019d
          ? [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff]
          : null;
      if (chunk === 'VP8L') {
        if (view.getUint8(20) !== 0x2f) return null;
        const bits = view.getUint32(21, true);
        return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
      }
      // Extended format; the animation flag is refused.
      if (chunk === 'VP8X') return view.getUint8(20) & 0x02 ? null : [u24(24) + 1, u24(27) + 1];
      return null;
    }
    if (type !== 'image/jpeg' || view.getUint16(0) !== 0xffd8) return null;
    // Walk the segments up to the frame header (SOF0-SOF15 without DHT, JPG and DAC).
    for (let at = 2; ;) {
      if (view.getUint8(at) !== 0xff) return null;
      const marker = view.getUint8(at + 1);
      if (marker === 0xff) at += 1;
      else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) at += 2;
      else if (marker === 0xd9 || marker === 0xda) return null;
      else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return [view.getUint16(at + 7), view.getUint16(at + 5)];
      else at += 2 + view.getUint16(at + 2);
    }
  } catch {
    return null;
  }
}

/** A JPEG, PNG or WebP data URL within the byte and pixel limits, its bytes matching its type. */
export function isImage(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64 + (MAX_IMAGE_BYTES * 4) / 3) return false;
  const [, type, data] = DATA_URL.exec(value) ?? [];
  if (!type || !data || data.length % 4) return false;
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  if (bytes.byteLength > MAX_IMAGE_BYTES) return false;
  const size = imageSize(type, bytes);
  return !!size && size.every((side) => side >= 1 && side <= MAX_IMAGE_SIDE);
}
