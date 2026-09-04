import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { markdown, excerpt } from './markdown.mjs';
import { ValidationError, validate } from './schema.mjs';

const CONTENT_ROOT = new URL('../content/', import.meta.url);

const slugify = (name) => name.replace(/\.md$/, '').toLowerCase();

/**
 * Load one content collection. Every entry is validated against the schema and
 * the whole collection is reported at once, so an editor fixing content sees
 * every problem in a single build rather than one per run.
 */
export async function loadCollection(name, schema, { sort } = {}) {
  const dir = new URL(`${name}/`, CONTENT_ROOT);
  let files;
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith('.md')).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const entries = [];
  const issues = [];

  for (const file of files) {
    const source = await readFile(new URL(file, dir), 'utf8');
    const { data, body } = parseFrontmatter(source, `content/${name}/${file}`);
    try {
      const validated = validate(schema, data, `content/${name}/${file}`);
      entries.push({
        ...validated,
        slug: validated.slug || slugify(file),
        body: markdown(body),
        excerpt: excerpt(body),
        _file: `src/content/${name}/${file}`,
      });
    } catch (error) {
      if (error instanceof ValidationError) issues.push(...error.issues);
      else throw error;
    }
  }

  if (issues.length) throw new ValidationError(issues);

  const published = entries.filter((entry) => entry.draft !== true);
  return sort ? published.sort(sort) : published;
}

/** Entries excluded from the build because they are still drafts. */
export async function loadDrafts(name, schema) {
  const dir = new URL(`${name}/`, CONTENT_ROOT);
  try {
    const files = (await readdir(dir)).filter((file) => file.endsWith('.md'));
    const drafts = [];
    for (const file of files) {
      const source = await readFile(new URL(file, dir), 'utf8');
      const { data } = parseFrontmatter(source, file);
      if (data.draft === true) drafts.push({ file: path.join('src/content', name, file), title: data.title || data.name || data.question });
    }
    return drafts;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
