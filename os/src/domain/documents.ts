/**
 * Document and research library.
 *
 * Files are stored privately under UPLOAD_DIR with random names and are only
 * served through an authenticated route as attachments. Each upload to an
 * existing document becomes a new version; earlier versions are kept.
 *
 * Search covers metadata only (title, description, source, tags, filenames)
 * through SQLite FTS5. File contents are not read or indexed, and the
 * interface says so. Content indexing would add a text-extraction step that
 * writes into the same documents_fts table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { all, get, run, tx } from '../db/database.ts';
import { newId, randomToken } from '../lib/ids.ts';
import { nowIso } from '../lib/time.ts';
import type { Actor } from '../http/context.ts';
import { type Field, type Values, ValidationError } from './fields.ts';
import { DOCUMENT_CATEGORIES, DOCUMENT_VERIFICATION, labelOf } from './vocabulary.ts';
import { getOrganization } from './organization.ts';
import { insertRow, logActivity, updateRow, setArchived } from './records.ts';
import { IN_ACTIVE_VENTURE } from './ventures.ts';

export const DOCUMENT_FIELDS: Field[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, max: 200, wide: true },
  { name: 'category', label: 'Category', type: 'select', required: true, options: DOCUMENT_CATEGORIES },
  { name: 'venture_id', label: 'Venture', type: 'ref', ref: 'venture', emptyLabel: 'NWPH (parent organization)' },
  { name: 'project_id', label: 'Project', type: 'ref', ref: 'project', emptyLabel: 'No project' },
  { name: 'document_date', label: 'Document date', type: 'date', help: 'Date of publication or authorship.' },
  { name: 'source', label: 'Source / author', type: 'text', max: 200 },
  { name: 'source_url', label: 'Source URL', type: 'url' },
  { name: 'version_label', label: 'Version', type: 'text', max: 40, placeholder: 'e.g. Draft 2, Final' },
  { name: 'tags', label: 'Tags', type: 'tags', help: 'Comma-separated.', wide: true },
  { name: 'description', label: 'Description', type: 'textarea', wide: true, max: 8000, help: 'Summarise what the document is. NWPH OS does not read file contents.' },
  { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
];

/** Verification changes the document's standing, so it is a separate, owner-only action. */
export const VERIFICATION_FIELD: Field = { name: 'verification_status', label: 'Verification', type: 'select', required: true, options: DOCUMENT_VERIFICATION };

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  zip: 'application/zip',
};

export interface DocumentRow {
  id: string;
  venture_id: string | null;
  venture_name: string | null;
  venture_slug: string | null;
  project_id: string | null;
  project_name: string | null;
  title: string;
  description: string | null;
  category: string;
  source: string | null;
  source_url: string | null;
  document_date: string | null;
  verification_status: string;
  version_label: string | null;
  notes: string | null;
  archived_at: string | null;
  is_example: number;
  created_at: string;
  updated_at: string;
  tags: string | null;
  file_count: number;
  latest_file_name: string | null;
}

export interface DocumentFile {
  id: string;
  document_id: string;
  version_number: number;
  original_name: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: string;
  uploaded_by_name: string | null;
}

const SELECT = `
  SELECT d.*, v.name AS venture_name, v.slug AS venture_slug, p.name AS project_name,
    (SELECT group_concat(t.name, ', ') FROM document_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.document_id = d.id) AS tags,
    (SELECT count(*) FROM document_files f WHERE f.document_id = d.id) AS file_count,
    (SELECT f.original_name FROM document_files f WHERE f.document_id = d.id ORDER BY f.version_number DESC LIMIT 1) AS latest_file_name
    FROM documents d
    LEFT JOIN ventures v ON v.id = d.venture_id
    LEFT JOIN projects p ON p.id = d.project_id`;

/** Turn free text into a safe FTS5 prefix query: each word quoted, ANDed. */
export function ftsQuery(q: string): string | null {
  const words = q
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 12);
  return words.length ? words.map((w) => `"${w}"*`).join(' ') : null;
}

export interface DocumentFilter {
  ventureId?: string | null;
  scope?: 'parent' | null;
  projectId?: string | null;
  category?: string | null;
  categories?: string[];
  tag?: string | null;
  verification?: string | null;
  q?: string | null;
  sort?: 'date' | 'title' | 'updated';
  archived?: boolean;
}

export function listDocuments(f: DocumentFilter = {}): DocumentRow[] {
  const where = [f.archived ? 'd.archived_at IS NOT NULL' : 'd.archived_at IS NULL'];
  const params: Record<string, string> = {};
  if (f.ventureId) {
    where.push('d.venture_id = :v');
    params.v = f.ventureId;
  } else if (f.scope === 'parent') where.push('d.venture_id IS NULL');
  else where.push(IN_ACTIVE_VENTURE('d'));
  if (f.projectId) {
    where.push('d.project_id = :p');
    params.p = f.projectId;
  }
  if (f.category) {
    where.push('d.category = :c');
    params.c = f.category;
  }
  if (f.categories?.length) {
    where.push(`d.category IN (${f.categories.map((_, i) => `:cat${i}`).join(', ')})`);
    f.categories.forEach((c, i) => (params[`cat${i}`] = c));
  }
  if (f.verification) {
    where.push('d.verification_status = :ver');
    params.ver = f.verification;
  }
  if (f.tag) {
    where.push('d.id IN (SELECT dt.document_id FROM document_tags dt JOIN tags t ON t.id = dt.tag_id WHERE t.name = :tag COLLATE NOCASE)');
    params.tag = f.tag;
  }
  const match = f.q ? ftsQuery(f.q) : null;
  if (f.q && !match) return [];
  if (match) {
    where.push('d.id IN (SELECT document_id FROM documents_fts WHERE documents_fts MATCH :match)');
    params.match = match;
  }
  const order = { date: 'd.document_date IS NULL, d.document_date DESC, d.created_at DESC', title: 'd.title COLLATE NOCASE', updated: 'd.updated_at DESC' }[f.sort ?? 'updated'];
  return all<DocumentRow>(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order}`, params);
}

export const getDocument = (id: string): DocumentRow | undefined => get<DocumentRow>(`${SELECT} WHERE d.id = ?`, [id]);

export const listFiles = (documentId: string): DocumentFile[] =>
  all<DocumentFile>(
    `SELECT f.*, u.display_name AS uploaded_by_name FROM document_files f LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.document_id = ? ORDER BY f.version_number DESC`,
    [documentId],
  );

export const getFile = (documentId: string, fileId: string): DocumentFile | undefined =>
  get<DocumentFile>('SELECT f.*, NULL AS uploaded_by_name FROM document_files f WHERE f.id = ? AND f.document_id = ?', [fileId, documentId]);

export const listTags = (): { name: string; n: number }[] =>
  all<{ name: string; n: number }>(
    `SELECT t.name, count(d.id) AS n FROM tags t JOIN document_tags dt ON dt.tag_id = t.id
       JOIN documents d ON d.id = dt.document_id AND d.archived_at IS NULL
      GROUP BY t.id ORDER BY t.name COLLATE NOCASE`,
  );

/** Records that cite this document as evidence or support. */
export function documentReferences(id: string): { kind: string; id: string; label: string }[] {
  return [
    ...all<{ id: string; label: string }>('SELECT id, title AS label FROM decisions WHERE evidence_document_id = ?', [id]).map((r) => ({ kind: 'decision', ...r })),
    ...all<{ id: string; label: string }>('SELECT id, description AS label FROM financial_entries WHERE document_id = ?', [id]).map((r) => ({ kind: 'financial_entry', ...r })),
  ];
}

function setTags(documentId: string, tags: string[]): void {
  run('DELETE FROM document_tags WHERE document_id = ?', [documentId]);
  for (const name of tags) {
    let tag = get<{ id: string }>('SELECT id FROM tags WHERE name = ? COLLATE NOCASE', [name]);
    if (!tag) {
      tag = { id: newId() };
      run('INSERT INTO tags (id, name) VALUES (?, ?)', [tag.id, name]);
    }
    run('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)', [documentId, tag.id]);
  }
}

function reindex(documentId: string): void {
  run('DELETE FROM documents_fts WHERE document_id = ?', [documentId]);
  const d = getDocument(documentId);
  if (!d) return;
  const files = listFiles(documentId)
    .map((f) => f.original_name)
    .join(' ');
  run('INSERT INTO documents_fts (document_id, title, description, source, tags, filenames) VALUES (?, ?, ?, ?, ?, ?)', [
    d.id,
    d.title,
    [d.description, d.notes].filter(Boolean).join('\n'),
    [d.source, d.source_url, d.category].filter(Boolean).join(' '),
    d.tags ?? '',
    files,
  ]);
}

function reconcile(values: Values): void {
  if (values.project_id) {
    const p = get<{ venture_id: string | null }>('SELECT venture_id FROM projects WHERE id = ?', [values.project_id as string]);
    if (p && (p.venture_id ?? null) !== (values.venture_id ?? null)) throw new ValidationError({ project_id: 'That project belongs to a different venture.' });
  }
}

export function createDocument(values: Values, actor: Actor): string {
  reconcile(values);
  const { tags, ...rest } = values;
  return tx(() => {
    const id = insertRow('document', { ...rest, organization_id: getOrganization().id, verification_status: 'unverified' });
    setTags(id, (tags as string[]) ?? []);
    reindex(id);
    logActivity({ actor, type: 'document.created', entityType: 'document', entityId: id, ventureId: values.venture_id as string | null, summary: `Document “${values.title}” added to ${values.category}` });
    return id;
  });
}

export function updateDocument(id: string, values: Values, actor: Actor): void {
  const before = getDocument(id);
  if (!before) throw new ValidationError({ _: 'Document not found.' });
  reconcile(values);
  const { tags, ...rest } = values;
  tx(() => {
    const changes = updateRow('document', id, rest);
    const newTags = ((tags as string[]) ?? []).join(', ');
    if ((before.tags ?? '') !== newTags) {
      setTags(id, (tags as string[]) ?? []);
      changes.tags = [before.tags, newTags || null];
    }
    reindex(id);
    if (Object.keys(changes).length) {
      logActivity({ actor, type: 'document.updated', entityType: 'document', entityId: id, ventureId: values.venture_id as string | null, summary: `Document “${values.title}” details updated`, changes });
    }
  });
}

export function setDocumentVerification(id: string, status: string, actor: Actor): void {
  const d = getDocument(id);
  if (!d) throw new ValidationError({ _: 'Document not found.' });
  if (!DOCUMENT_VERIFICATION.some((o) => o.value === status)) throw new ValidationError({ verification_status: 'Invalid verification status.' });
  const changes = updateRow('document', id, { verification_status: status });
  if (Object.keys(changes).length) {
    logActivity({ actor, type: 'document.verification_changed', entityType: 'document', entityId: id, ventureId: d.venture_id, summary: `Document “${d.title}” marked ${labelOf(DOCUMENT_VERIFICATION, status).toLowerCase()}`, changes });
  }
}

export function archiveDocument(id: string, archived: boolean, actor: Actor): void {
  const d = getDocument(id);
  if (d && setArchived('document', id, archived)) {
    logActivity({ actor, type: `document.${archived ? 'archived' : 'restored'}`, entityType: 'document', entityId: id, ventureId: d.venture_id, summary: `Document “${d.title}” ${archived ? 'archived' : 'restored'}` });
  }
}

// ── Files ────────────────────────────────────────────────────────────────────

export function safeFileName(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return base.slice(-180) || 'file';
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export async function addFile(documentId: string, file: File, uploadDir: string, maxBytes: number, actor: Actor): Promise<DocumentFile> {
  const doc = getDocument(documentId);
  if (!doc) throw new ValidationError({ file: 'Document not found.' });
  const originalName = safeFileName(file.name);
  const ext = extensionOf(originalName);
  const mime = ALLOWED_EXTENSIONS[ext];
  if (!mime) {
    throw new ValidationError({ file: `Files of type “.${ext || '?'}” are not accepted. Allowed: ${Object.keys(ALLOWED_EXTENSIONS).join(', ')}.` });
  }
  if (file.size > maxBytes) throw new ValidationError({ file: `The file is larger than the ${Math.round(maxBytes / 1048576)} MB limit.` });
  if (file.size === 0) throw new ValidationError({ file: 'The file is empty.' });

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = randomToken(24);
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
  const finalPath = path.join(uploadDir, storageKey);
  const tmpPath = `${finalPath}.part`;
  fs.writeFileSync(tmpPath, bytes, { mode: 0o600 });
  fs.renameSync(tmpPath, finalPath);
  try {
    return tx(() => {
      const version = (get<{ v: number | null }>('SELECT max(version_number) AS v FROM document_files WHERE document_id = ?', [documentId])!.v ?? 0) + 1;
      const id = newId();
      run(
        `INSERT INTO document_files (id, document_id, version_number, original_name, storage_key, mime_type, size_bytes, sha256, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, documentId, version, originalName, storageKey, mime, bytes.length, createHash('sha256').update(bytes).digest('hex'), actor.id, nowIso()],
      );
      run('UPDATE documents SET updated_at = ? WHERE id = ?', [nowIso(), documentId]);
      reindex(documentId);
      logActivity({
        actor,
        type: 'document.uploaded',
        entityType: 'document',
        entityId: documentId,
        ventureId: doc.venture_id,
        summary: `File “${originalName}” uploaded to “${doc.title}” as version ${version}`,
      });
      return getFile(documentId, id)!;
    });
  } catch (err) {
    fs.rmSync(finalPath, { force: true });
    throw err;
  }
}

/** Resolve a stored file path, refusing anything that escapes the upload directory. */
export function filePath(uploadDir: string, storageKey: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(storageKey)) throw new Error('Invalid storage key');
  return path.join(uploadDir, storageKey);
}
