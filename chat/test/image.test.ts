import assert from 'node:assert/strict';
import test from 'node:test';
import { isImage, MAX_IMAGE_BYTES } from '../src/image.ts';

/** Just enough of each format's header for the size to be read. */
function png(width: number, height: number) {
  const bytes = Buffer.alloc(33);
  bytes.write('\x89PNG\r\n\x1a\n', 0, 'latin1');
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpeg(width: number, height: number) {
  // SOI, a 16-byte APP0 segment, then SOF0 with height and width.
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255];
  return Buffer.from([0xff, 0xd8, ...app0, ...sof, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
}

function webp(chunk: 'VP8 ' | 'VP8L' | 'VP8X', width: number, height: number, flags = 0) {
  const data = Buffer.alloc(10);
  if (chunk === 'VP8 ') {
    data.set([0, 0, 0, 0x9d, 0x01, 0x2a]);
    data.writeUInt16LE(width, 6);
    data.writeUInt16LE(height, 8);
  } else if (chunk === 'VP8L') {
    data[0] = 0x2f;
    data.writeUInt32LE((width - 1) | ((height - 1) << 14), 1);
  } else {
    data[0] = flags;
    data.writeUIntLE(width - 1, 4, 3);
    data.writeUIntLE(height - 1, 7, 3);
  }
  const head = Buffer.alloc(20);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(22, 4);
  head.write('WEBP', 8, 'latin1');
  head.write(chunk, 12, 'latin1');
  head.writeUInt32LE(10, 16);
  return Buffer.concat([head, data]);
}

const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString('base64')}`;

test('JPEG, PNG and WebP data URLs within the limits are accepted', () => {
  assert.ok(isImage(dataUrl('image/png', png(800, 600))));
  assert.ok(isImage(dataUrl('image/jpeg', jpeg(2048, 1536))));
  assert.ok(isImage(dataUrl('image/webp', webp('VP8 ', 640, 480))));
  assert.ok(isImage(dataUrl('image/webp', webp('VP8L', 1024, 1))));
  assert.ok(isImage(dataUrl('image/webp', webp('VP8X', 2048, 2048))));
});

test('remote URLs, other types, mismatched bytes and broken headers are refused', () => {
  const refused = [
    'https://example.com/a.png',
    '//example.com/a.png',
    dataUrl('image/gif', Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1')),
    dataUrl('image/svg+xml', Buffer.from('<svg/>')),
    // The declared type must match the bytes.
    dataUrl('image/jpeg', png(10, 10)),
    dataUrl('image/png', jpeg(10, 10)),
    dataUrl('image/webp', png(10, 10)),
    // Truncated headers.
    dataUrl('image/png', png(10, 10).subarray(0, 20)),
    dataUrl('image/jpeg', jpeg(10, 10).subarray(0, 24)),
    // Animated WebP and empty sizes.
    dataUrl('image/webp', webp('VP8X', 10, 10, 0x02)),
    dataUrl('image/png', png(0, 10)),
    // Not strict base64.
    `data:image/png;base64,${png(10, 10).toString('base64')}%`,
    `data:image/png;base64,${png(10, 10).toString('base64').slice(0, -1)}`,
    `data:image/png;charset=utf-8;base64,${png(10, 10).toString('base64')}`,
    42,
    null,
  ];
  for (const value of refused) assert.equal(isImage(value), false, String(value).slice(0, 60));
});

test('images over the pixel or byte limit are refused', () => {
  assert.equal(isImage(dataUrl('image/png', png(2049, 10))), false);
  assert.equal(isImage(dataUrl('image/jpeg', jpeg(10, 4096))), false);
  assert.equal(isImage(dataUrl('image/webp', webp('VP8X', 10, 2049))), false);
  const big = Buffer.concat([png(10, 10), Buffer.alloc(MAX_IMAGE_BYTES)]);
  assert.equal(isImage(dataUrl('image/png', big)), false);
});
