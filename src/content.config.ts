import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineCollection } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { CORE_SCHEMA, load } from 'js-yaml';

/**
 * Loads one YAML list; each item becomes an entry and the ids keep the file order.
 * Own loader instead of file(): file() only logs YAML syntax errors and ships an empty list.
 */
const yamlList = (file: string): Loader => ({
  name: `yaml:${file}`,
  load: async ({ config, store, parseData, logger, watcher }) => {
    const path = fileURLToPath(new URL(file, config.root));
    const sync = async () => {
      const raw = load(await readFile(path, 'utf8'), { schema: CORE_SCHEMA, filename: file });
      if (!Array.isArray(raw)) throw new Error(`${file} must be a YAML list`);
      const entries = await Promise.all(
        raw.map(async (item: unknown, i) => {
          const id = String(i).padStart(3, '0');
          const data = item as Record<string, unknown>;
          return { id, filePath: file, data: await parseData({ id, data, filePath: file }) };
        }),
      );
      store.clear();
      entries.forEach((entry) => store.set(entry));
    };
    await sync();
    watcher?.add(path);
    watcher?.on('change', (changed) => {
      if (changed === path) sync().catch((error: Error) => logger.error(error.message));
    });
  },
});

const text = z.string().trim().min(1);

const projects = defineCollection({
  loader: yamlList('src/data/projects.yaml'),
  schema: z.strictObject({
    name: text,
    formerly: text.optional(),
    group: z.enum(['ai', 'tools', 'web', 'android', 'extensions', 'earlier']),
    kind: text,
    stack: z.array(text).min(1),
    featured: z
      .strictObject({
        order: z.number().int().min(1),
        area: z.enum(['AI and language', 'Backend and web', 'Android apps']),
      })
      .optional(),
    source: z.enum(['public', 'private']).default('public'),
    problem: text,
    approach: text,
    specimen: z.strictObject({ before: text, after: text }).optional(),
    result: text,
    as_of: text,
    cs: z.strictObject({
      kind: text,
      problem: text,
      approach: text,
      result: text,
      as_of: text,
    }),
    links: z.array(z.strictObject({ label: text, href: z.url({ protocol: /^https$/ }) })).min(1),
  }),
});

export const collections = { projects };
