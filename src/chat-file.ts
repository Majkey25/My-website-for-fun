export type ChatFile = { filename: string; file_data: string };

export const FILE_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  log: 'text/plain',
} as const;

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_TEXT_FILE_BYTES = 128 * 1024;
export const MAX_ATTACHMENTS = 3;
// Three 2 MiB documents as base64, plus bounded text and JSON overhead.
export const MAX_CHAT_BYTES = 9 * 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
const control = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
const core = { docx: 'word/document.xml', xlsx: 'xl/workbook.xml', pptx: 'ppt/presentation.xml' };

// Structural screening only: documents are never decompressed or executed here.
function office(bytes: Uint8Array, required: string): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const earliest = Math.max(0, bytes.length - 65_557);
  let end = bytes.length - 22;
  for (; end >= earliest; end--)
    if (
      view.getUint32(end, true) === 0x06054b50 &&
      end + 22 + view.getUint16(end + 20, true) === bytes.length
    )
      break;
  if (end < earliest) return false;
  const count = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const start = view.getUint32(end + 16, true);
  if (
    view.getUint32(end + 4, true) ||
    view.getUint16(end + 8, true) !== count ||
    !count ||
    count > 256 ||
    start + size !== end
  )
    return false;
  const names = new Set<string>();
  let at = start;
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) return false;
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const packed = view.getUint32(at + 20, true);
    const unpacked = view.getUint32(at + 24, true);
    const length = view.getUint16(at + 28, true);
    const next = at + 46 + length + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    if (
      flags & 0x41 ||
      ![0, 8].includes(method) ||
      view.getUint16(at + 34, true) ||
      next > end ||
      local + 30 > start
    )
      return false;
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + length));
    if (
      !name ||
      control.test(name) ||
      name.startsWith('/') ||
      /[\\:]/.test(name) ||
      name.split('/').includes('..') ||
      /(?:^|\/)(?:vbaProject\.bin$|macrosheets\/)/i.test(name) ||
      names.has(name)
    )
      return false;
    if (
      view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method
    )
      return false;
    const localLength = view.getUint16(local + 26, true);
    const data = local + 30 + localLength + view.getUint16(local + 28, true);
    if (
      data + packed > start ||
      decoder.decode(bytes.subarray(local + 30, local + 30 + localLength)) !== name
    )
      return false;
    if (
      !(flags & 8) &&
      (view.getUint32(local + 18, true) !== packed || view.getUint32(local + 22, true) !== unpacked)
    )
      return false;
    expanded += unpacked;
    if (expanded > 8 * 1024 * 1024 || (method === 0 && packed !== unpacked)) return false;
    if (!name.endsWith('/') && (!unpacked || !packed)) return false;
    names.add(name);
    at = next;
  }
  return at === end && names.has('[Content_Types].xml') && names.has(required);
}

/** Checks the filename, exact MIME, byte limits and the supported file's structure. */
export function isChatFile(value: unknown): value is ChatFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (Object.keys(value).length !== 2) return false;
  const { filename, file_data } = value as Record<string, unknown>;
  if (
    typeof filename !== 'string' ||
    !filename ||
    filename.length > 240 ||
    [...filename].length > 120 ||
    !filename.isWellFormed() ||
    /[:\/\\\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(filename)
  )
    return false;
  const extension = filename.split('.').at(-1)?.toLowerCase();
  if (!extension || !Object.hasOwn(FILE_TYPES, extension)) return false;
  const mime = FILE_TYPES[extension as keyof typeof FILE_TYPES];
  const limit =
    extension === 'pdf' || Object.hasOwn(core, extension) ? MAX_FILE_BYTES : MAX_TEXT_FILE_BYTES;
  if (typeof file_data !== 'string' || file_data.length > 128 + Math.ceil(limit / 3) * 4)
    return false;
  const prefix = `data:${mime};base64,`;
  if (!file_data.startsWith(prefix)) return false;
  const data = file_data.slice(prefix.length);
  if (!data || data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return false;
  try {
    const binary = atob(data);
    if (!binary.length || binary.length > limit || btoa(binary) !== data) return false;
    if (extension === 'pdf')
      return /^%PDF-[12]\.\d/.test(binary) && /%%EOF[\t\n\r ]*$/.test(binary.slice(-1024));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (Object.hasOwn(core, extension)) return office(bytes, core[extension as keyof typeof core]);
    return !control.test(decoder.decode(bytes));
  } catch {
    return false;
  }
}
