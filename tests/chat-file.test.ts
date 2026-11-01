import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { FILE_TYPES, isChatFile, MAX_FILE_BYTES, MAX_TEXT_FILE_BYTES } from '../src/chat-file.ts';

const file = (filename: string, data: string | Uint8Array, mime?: string) => ({
  filename,
  file_data: `data:${mime ?? FILE_TYPES[filename.split('.').at(-1)!.toLowerCase() as keyof typeof FILE_TYPES]};base64,${Buffer.from(data).toString('base64')}`,
});

/** Small real stored ZIP entries, with matching local/central headers and CRCs. */
function zip(
  names: string[],
  options: { flags?: number; expanded?: number; deflate?: boolean } = {},
) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const name of names) {
    const filename = Buffer.from(name);
    const body = Buffer.from('<?xml version="1.0"?><root/>');
    const packed = options.deflate ? deflateRawSync(body) : body;
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(options.flags ?? 0, 6);
    local.writeUInt16LE(options.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(options.expanded ?? body.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(options.flags ?? 0, 8);
    entry.writeUInt16LE(options.deflate ? 8 : 0, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(options.expanded ?? body.length, 24);
    entry.writeUInt16LE(filename.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, filename);
    offset += local.length + filename.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

test('allowed UTF-8 text, PDF and matching OpenXML documents pass', () => {
  for (const extension of ['txt', 'md', 'csv', 'json', 'yaml', 'yml', 'log'])
    assert(isChatFile(file(`Příloha.${extension}`, 'Žluťoučký kůň\n\tText.')));
  assert(isChatFile(file('CV.PDF', '%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')));
  for (const [extension, core] of [
    ['docx', 'word/document.xml'],
    ['xlsx', 'xl/workbook.xml'],
    ['pptx', 'ppt/presentation.xml'],
  ])
    for (const deflate of [false, true])
      assert(
        isChatFile(
          file(
            `document.${extension}`,
            zip(['[Content_Types].xml', core!], { deflate, flags: 0x800 }),
          ),
        ),
      );
});

test('unsupported, disguised, empty and noncanonical data are rejected without throwing', () => {
  const valid = file('note.txt', 'hello');
  for (const value of [
    null,
    [],
    {},
    { ...valid, filename: 5 },
    { ...valid, file_data: null },
    { ...valid, type: 'input_image', image_url: 'https://example.com/private' },
    file('run.exe', 'hello', 'text/plain'),
    file('note.txt', '', 'text/plain'),
    file('fake.pdf', 'not a PDF'),
    file('truncated.pdf', '%PDF-1.7\nno EOF'),
    file('wrong.txt', 'hello', 'application/json'),
    { ...valid, file_data: 'data:text/plain;base64,Zg=' },
    { ...valid, file_data: 'data:text/plain;base64,Zh==' },
    { ...valid, file_data: 'data:text/plain;base64,aGVs\nbG8=' },
    { ...valid, file_data: 'https://example.com/file.txt' },
  ])
    assert.equal(isChatFile(value), false);
});

test('filenames, UTF-8, binary controls and byte limits are enforced', () => {
  for (const filename of [
    '../note.txt',
    'C:\\note.txt',
    'C:note.txt',
    'evil\n.txt',
    'evil\u202e.txt',
    'x'.repeat(117) + '.txt',
  ])
    assert.equal(isChatFile(file(filename, 'text')), false);
  for (const bytes of [Uint8Array.of(0xff, 0xfe), Uint8Array.of(65, 0, 66), Uint8Array.of(27, 65)])
    assert.equal(isChatFile(file('binary.txt', bytes)), false);
  assert(isChatFile(file('limit.txt', 'x'.repeat(MAX_TEXT_FILE_BYTES))));
  assert.equal(isChatFile(file('large.txt', 'x'.repeat(MAX_TEXT_FILE_BYTES + 1))), false);
  assert.equal(
    isChatFile(file('large.pdf', '%PDF-1.7\n' + 'x'.repeat(MAX_FILE_BYTES) + '%%EOF')),
    false,
  );
});

test('OpenXML rejects wrong subtype, macros, encrypted and unsafe ZIP entries', () => {
  const validNames = ['[Content_Types].xml', 'word/document.xml'];
  for (const bytes of [
    zip(['word/document.xml']),
    zip(['[Content_Types].xml', 'xl/workbook.xml']),
    zip([...validNames, 'word/vbaProject.bin']),
    zip([...validNames, 'xl/macrosheets/sheet1.xml']),
    zip([...validNames, '../outside']),
    zip([...validNames, '/absolute']),
    zip([...validNames, 'C:\\outside']),
    zip([...validNames, 'word/document.xml']),
    zip(validNames, { flags: 1 }),
    zip(validNames, { flags: 64 }),
    zip(validNames, { expanded: 8 * 1024 * 1024 }),
    zip(Array.from({ length: 257 }, (_, i) => `entry${i}.xml`)),
  ])
    assert.equal(isChatFile(file('document.docx', bytes)), false);
});

test('truncated or inconsistent ZIP directory and local headers are rejected', () => {
  const bytes = zip(['[Content_Types].xml', 'word/document.xml']);
  const wrongOffset = Buffer.from(bytes);
  wrongOffset.writeUInt32LE(0xffffffff, wrongOffset.length - 6);
  const wrongCount = Buffer.from(bytes);
  wrongCount.writeUInt16LE(1, wrongCount.length - 12);
  const wrongHeader = Buffer.from(bytes);
  wrongHeader[0] = 0;
  const wrongLocalName = Buffer.from(bytes);
  wrongLocalName[30] = 120;
  for (const malformed of [
    bytes.subarray(0, -1),
    bytes.subarray(0, 12),
    wrongOffset,
    wrongCount,
    wrongHeader,
    wrongLocalName,
  ])
    assert.equal(isChatFile(file('document.docx', malformed)), false);
});
