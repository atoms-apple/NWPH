/**
 * A deliberately small YAML-subset parser for content frontmatter.
 *
 * Supports what the content model actually uses: scalars (string, number,
 * boolean, null), inline `[a, b]` arrays, block `- item` arrays, and one level
 * of nested mapping. Anything else throws, loudly and with the file name — a
 * silent misparse of a `status:` value is exactly the failure this project
 * cannot afford.
 */

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseScalar(text) {
  const value = text.trim();
  if (value === '') return '';
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;

  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
  if (quoted) return quoted[2];

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    return inner === '' ? [] : splitTop(inner).map(parseScalar);
  }

  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d*\.\d+$/.test(value)) return Number.parseFloat(value);

  return value;
}

/** Split on commas that are not inside quotes. */
function splitTop(text) {
  const parts = [];
  let current = '';
  let quote = null;
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function parseBlock(lines, start, indent, file) {
  const result = {};
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
    const currentIndent = indentOf(line);
    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      throw new Error(`Unexpected indentation in frontmatter of ${file}, line ${i + 1}: ${line}`);
    }

    const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(line.trim());
    if (!match) throw new Error(`Cannot parse frontmatter of ${file}, line ${i + 1}: ${line}`);

    const [, key, rest] = match;
    const inline = rest.trim();
    i++;

    if (inline !== '') {
      result[key] = parseScalar(inline);
      continue;
    }

    // Look ahead: a block list, a nested mapping, or an empty value.
    const next = lines.slice(i).find((candidate) => candidate.trim() !== '');
    if (!next || indentOf(next) <= indent) { result[key] = null; continue; }

    const childIndent = indentOf(next);
    if (next.trim().startsWith('- ') || next.trim() === '-') {
      const items = [];
      while (i < lines.length) {
        const candidate = lines[i];
        if (candidate.trim() === '') { i++; continue; }
        if (indentOf(candidate) !== childIndent || !candidate.trim().startsWith('-')) break;
        items.push(parseScalar(candidate.trim().replace(/^-\s*/, '')));
        i++;
      }
      result[key] = items;
    } else {
      const [nested, consumed] = parseBlock(lines, i, childIndent, file);
      result[key] = nested;
      i = consumed;
    }
  }

  return [result, i];
}

/** Split a content file into `{ data, body }`. */
export function parseFrontmatter(source, file = '<unknown>') {
  const match = FENCE.exec(source);
  if (!match) return { data: {}, body: source };
  const lines = match[1].split(/\r?\n/);
  const [data] = parseBlock(lines, 0, 0, file);
  return { data, body: source.slice(match[0].length) };
}
