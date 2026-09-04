/**
 * Minimal CommonMark subset: headings, paragraphs, lists, blockquotes, rules,
 * links, emphasis and inline code. Content is escaped before any markup is
 * applied, so a stray `<script>` in a content file renders as text.
 *
 * Headings start at <h2>: page templates own the single <h1>.
 */

import { esc } from './html.mjs';

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links: [label](href) — only http(s), mailto, tel and site-relative targets.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
    if (!/^(https?:\/\/|mailto:|tel:|\/|#)/.test(href)) return match;
    const external = /^https?:\/\//.test(href);
    const rel = external ? ' rel="noopener noreferrer"' : '';
    return `<a href="${href}"${rel}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return out;
}

export function markdown(source) {
  if (!source || !source.trim()) return '';

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const flushList = (ordered, items) => {
    const tag = ordered ? 'ol' : 'ul';
    out.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { out.push('<hr />'); i++; continue; }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (line.trim().startsWith('> ')) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const pattern = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      const items = [];
      while (i < lines.length) {
        const match = pattern.exec(lines[i]);
        if (!match) break;
        items.push(match[1]);
        i++;
      }
      flushList(ordered, items);
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{2,4}\s|>\s|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      paragraph.push(lines[i].trim());
      i++;
    }
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  return out.join('\n');
}

/** First paragraph as plain text — used for meta descriptions. */
export function excerpt(source, limit = 160) {
  const text = String(source || '')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/[*`>_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
    .split(/\n\s*\n/)[0]
    ?.replace(/\s+/g, ' ')
    .trim() ?? '';
  if (text.length <= limit) return text;
  return text.slice(0, text.lastIndexOf(' ', limit - 1)).trim() + '…';
}
