import fs from 'node:fs';
import { html, paragraphs, type SafeHtml } from '../../lib/html.ts';
import { formatDateTime } from '../../lib/time.ts';
import { htmlReply, redirect, HttpError, type Context, type Reply } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import {
  DOCUMENT_FIELDS,
  ALLOWED_EXTENSIONS,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  archiveDocument,
  setDocumentVerification,
  listFiles,
  getFile,
  addFile,
  filePath,
  listTags,
  documentReferences,
  extensionOf,
  type DocumentRow,
} from '../../domain/documents.ts';
import { DOCUMENT_CATEGORIES, DOCUMENT_VERIFICATION } from '../../domain/vocabulary.ts';
import { listActivity } from '../../domain/records.ts';
import { ValidationError, type Errors } from '../../domain/fields.ts';
import { page } from '../layout.ts';
import { pageHeader, section, badge, statusBadge, emptyState, linkButton, postButton, filterBar, date, scopeLink, exampleBadge, archivedBadge, definitionList, notice } from '../ui.ts';
import { renderForm, toFormValues, fieldRow, type FormValues } from '../forms.ts';
import { submit, refOptions, prefill, returnTo, notFound, ventureScope, ventureFilterOptions, archiveReply, UUID_RE } from '../common.ts';
import { activityList } from './activity.ts';

export const SEARCH_LIMITATION = 'Search covers titles, descriptions, sources, tags and file names. File contents are not read or searched.';

const formatSize = (n: number): string => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function documentTable(docs: DocumentRow[], opts: { showVenture?: boolean } = {}): SafeHtml {
  if (!docs.length) return emptyState('No documents', 'Add business plans, research, government publications, meeting notes and other material, with their sources.');
  return html`<div class="table-wrap"><table class="table table--stack">
    <thead><tr><th scope="col">Document</th><th scope="col">Category</th>${opts.showVenture !== false ? html`<th scope="col">Venture</th>` : ''}<th scope="col">Date</th><th scope="col">Verification</th></tr></thead>
    <tbody>${docs.map(
      (d) => html`<tr>
        <th scope="row" data-label="Document"><a href="/documents/${d.id}">${d.title}</a> ${exampleBadge(d.is_example)}${archivedBadge(d.archived_at)}
          <span class="cell-meta">${d.file_count ? `${d.latest_file_name}${d.file_count > 1 ? ` (${d.file_count} versions)` : ''}` : 'Metadata only, no file'}${d.source ? ` · ${d.source}` : ''}</span>
          ${d.tags ? html`<span class="tags">${d.tags.split(', ').map((t) => html`<a class="tag" href="/documents?tag=${encodeURIComponent(t)}">${t}</a>`)}</span>` : ''}</th>
        <td data-label="Category">${d.category}</td>
        ${opts.showVenture !== false ? html`<td data-label="Venture">${scopeLink(d)}</td>` : ''}
        <td data-label="Date">${date(d.document_date)}</td>
        <td data-label="Verification">${statusBadge(DOCUMENT_VERIFICATION, d.verification_status)}</td>
      </tr>`,
    )}</tbody></table></div>`;
}

function fileInput(maxBytes: number, error?: string): SafeHtml {
  return html`<div class="${error ? 'field field--wide field--error' : 'field field--wide'}">
    <label for="f-file">File</label>
    <input type="file" id="f-file" name="file" accept="${Object.keys(ALLOWED_EXTENSIONS).map((e) => '.' + e).join(',')}" aria-describedby="f-file-help">
    <p class="field__help" id="f-file-help">Optional. Up to ${Math.round(maxBytes / 1048576)} MB. Accepted: ${Object.keys(ALLOWED_EXTENSIONS).join(', ')}. Files are stored privately and only downloadable by signed-in users.</p>
    ${error ? html`<p class="field__error">${error}</p>` : ''}
  </div>`;
}

function formPage(ctx: Context, opts: { id?: string; values: FormValues; errors?: Errors }): string {
  const editing = Boolean(opts.id);
  const back = returnTo(ctx, editing ? `/documents/${opts.id}` : '/documents');
  return page(ctx, {
    title: editing ? 'Edit document' : 'Add document',
    active: 'documents',
    body: html`${pageHeader({ title: editing ? 'Edit document details' : 'Add document', eyebrow: 'Documents & Research' })}
    ${section('Details', renderForm(ctx, {
      action: editing ? `/documents/${opts.id}` : '/documents',
      fields: DOCUMENT_FIELDS,
      values: opts.values,
      errors: opts.errors,
      refs: refOptions(DOCUMENT_FIELDS, opts.values),
      submitLabel: editing ? 'Save changes' : 'Add document',
      cancelHref: back,
      hidden: { _return: back },
      multipart: !editing,
      after: editing ? null : fileInput(ctx.config.maxUploadBytes, opts.errors?.file),
    }))}`,
  });
}

/** Check the file before any record is created, so a rejected upload leaves nothing behind. */
function precheckFile(file: File | null, maxBytes: number): void {
  if (!file) return;
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS[ext]) throw new ValidationError({ file: `Files of type “.${ext || '?'}” are not accepted.` });
  if (file.size > maxBytes) throw new ValidationError({ file: `The file is larger than the ${Math.round(maxBytes / 1048576)} MB limit.` });
}

export function registerDocuments(router: Router): void {
  router.get('/documents', 'read', (ctx) => {
    const scope = ventureScope(ctx);
    const q = ctx.query.get('q') ?? '';
    const category = ctx.query.get('category') ?? '';
    const tag = ctx.query.get('tag') ?? '';
    const verification = ctx.query.get('verification') ?? '';
    const sort = (['date', 'title', 'updated'] as const).find((s) => s === ctx.query.get('sort')) ?? 'updated';
    const archived = ctx.query.get('archived') === '1';
    const docs = listDocuments({ ventureId: scope.ventureId, scope: scope.scope, q, category, tag, verification, sort, archived });
    const tags = listTags();
    const body = html`${pageHeader({
      title: 'Documents & Research',
      lede: 'The central library for plans, research, policies, records and source material, organised by venture, project, category and tag.',
      actions: ctx.can('write') ? linkButton(`/documents/new${scope.venture ? `?venture=${scope.venture.slug}` : ''}`, 'Add document', 'primary') : null,
    })}
    ${filterBar({
      action: '/documents',
      hidden: { tag },
      q: { value: q, placeholder: 'Search document metadata', label: 'Search documents' },
      selects: [
        { name: 'venture', label: 'Venture', value: scope.slug, options: ventureFilterOptions() },
        { name: 'category', label: 'Category', value: category, options: DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c })) },
        { name: 'verification', label: 'Verification', value: verification, options: DOCUMENT_VERIFICATION },
        { name: 'sort', label: 'Sort', emptyLabel: 'Recently updated', value: sort === 'updated' ? '' : sort, options: [{ value: 'date', label: 'Document date' }, { value: 'title', label: 'Title' }] },
      ],
      checks: [{ name: 'archived', label: 'Archived only', checked: archived }],
      note: SEARCH_LIMITATION,
    })}
    ${tag ? notice('info', html`Showing documents tagged <strong>${tag}</strong>. <a href="/documents">Clear tag</a>`) : ''}
    <div class="grid grid--sidebar">
      ${section(`${docs.length} ${docs.length === 1 ? 'document' : 'documents'}`, documentTable(docs))}
      ${section('Tags', tags.length ? html`<p class="tags">${tags.map((t) => html`<a class="tag" href="/documents?tag=${encodeURIComponent(t.name)}">${t.name} <span class="muted">${t.n}</span></a>`)}</p>` : html`<p class="muted">No tags yet.</p>`)}
    </div>`;
    return htmlReply(page(ctx, { title: 'Documents & Research', active: 'documents', body }));
  });

  router.get('/documents/new', 'write', (ctx) => {
    const values = prefill(ctx, { category: ctx.query.get('category') && DOCUMENT_CATEGORIES.includes(ctx.query.get('category')!) ? ctx.query.get('category')! : '' });
    return htmlReply(formPage(ctx, { values }));
  });
  router.post('/documents', 'write', async (ctx): Promise<Reply> => {
    const file = ctx.form.file('file');
    let createdId: string | null = null;
    const reply = submit(ctx, DOCUMENT_FIELDS, (values) => {
      precheckFile(file, ctx.config.maxUploadBytes);
      createdId = createDocument(values, ctx.actor);
      return redirect(`/documents/${createdId}`);
    }, (values, errors) => formPage(ctx, { values, errors }));
    if (createdId && file) {
      try {
        await addFile(createdId, file, ctx.config.uploadDir, ctx.config.maxUploadBytes, ctx.actor);
        ctx.flash('success', 'Document added with its file.');
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        ctx.flash('error', `The document record was created, but the file was not stored: ${Object.values(err.errors)[0]}`);
      }
    } else if (createdId) {
      ctx.flash('success', 'Document record added. You can upload a file from this page.');
    }
    return reply;
  });

  router.get('/documents/:id', 'read', (ctx) => {
    const d = getDocument(ctx.params.id!) ?? notFound('Document');
    const files = listFiles(d.id);
    const refs = documentReferences(d.id);
    const body = html`${pageHeader({
      eyebrow: html`${d.category} · ${scopeLink(d, '/documents')}`,
      title: d.title,
      meta: html`${statusBadge(DOCUMENT_VERIFICATION, d.verification_status)} ${d.version_label ? badge(d.version_label) : ''} ${exampleBadge(d.is_example)} ${archivedBadge(d.archived_at)}`,
      actions: html`${ctx.can('write') ? linkButton(`/documents/${d.id}/edit`, 'Edit details', 'primary') : ''}${ctx.can('archive') ? postButton(ctx, `/documents/${d.id}/${d.archived_at ? 'restore' : 'archive'}`, d.archived_at ? 'Restore' : 'Archive', { variant: 'ghost', confirm: d.archived_at ? undefined : 'Archive this document? Files are kept and it can be restored.' }) : ''}`,
    })}
    <div class="grid grid--sidebar">
      <div>
        ${section('About this document', html`${definitionList([
          { label: 'Description', value: paragraphs(d.description) },
          { label: 'Source / author', value: d.source },
          { label: 'Source URL', value: d.source_url ? html`<a href="${d.source_url}" rel="noopener noreferrer" target="_blank">${d.source_url}</a>` : null },
          { label: 'Document date', value: d.document_date ? date(d.document_date) : null },
          { label: 'Project', value: d.project_id ? html`<a href="/projects/${d.project_id}">${d.project_name}</a>` : null },
          { label: 'Tags', value: d.tags ? html`<span class="tags">${d.tags.split(', ').map((t) => html`<a class="tag" href="/documents?tag=${encodeURIComponent(t)}">${t}</a>`)}</span>` : null },
          { label: 'Notes', value: paragraphs(d.notes) },
        ])}<p class="footnote">NWPH OS stores this file but has not read or analysed its contents. The description above was written by a user.</p>`)}
        ${section('Files and versions', html`${files.length
          ? html`<div class="table-wrap"><table class="table table--stack"><thead><tr><th scope="col">Version</th><th scope="col">File</th><th scope="col">Size</th><th scope="col">Uploaded</th></tr></thead>
            <tbody>${files.map((f, i) => html`<tr><th scope="row" data-label="Version">v${f.version_number}${i === 0 ? html` ${badge('Latest', 'info')}` : ''}</th>
              <td data-label="File"><a href="/documents/${d.id}/files/${f.id}">${f.original_name}</a><span class="cell-meta">SHA-256 ${f.sha256.slice(0, 12)}…</span></td>
              <td data-label="Size">${formatSize(f.size_bytes)}</td><td data-label="Uploaded">${formatDateTime(f.uploaded_at)}${f.uploaded_by_name ? html`<span class="cell-meta">${f.uploaded_by_name}</span>` : ''}</td></tr>`)}</tbody></table></div>`
          : html`<p class="muted">No file uploaded. This is a metadata record only.</p>`}
          ${ctx.can('write') && !d.archived_at ? html`<form method="post" action="/documents/${d.id}/files" enctype="multipart/form-data" class="form form--compact">
            <input type="hidden" name="_csrf" value="${ctx.csrf}">
            ${fileInput(ctx.config.maxUploadBytes)}
            <div class="form__actions"><button type="submit" class="btn btn--secondary">${files.length ? 'Upload new version' : 'Upload file'}</button></div>
          </form>` : ''}`)}
      </div>
      <div>
        ${ctx.can('verify')
          ? section('Verification', html`<form method="post" action="/documents/${d.id}/verification" class="form form--compact">
              <input type="hidden" name="_csrf" value="${ctx.csrf}">
              ${fieldRow({ name: 'verification_status', label: 'Status', type: 'select', required: true, options: DOCUMENT_VERIFICATION, help: 'Verified means an owner has checked the source and content.' }, { verification_status: d.verification_status }, {}, {})}
              <div class="form__actions"><button type="submit" class="btn btn--secondary">Update</button></div></form>`)
          : ''}
        ${section('Referenced by', refs.length
          ? html`<ul class="list">${refs.map((r) => html`<li class="list__item"><a href="${r.kind === 'decision' ? `/decisions/${r.id}` : `/finance/entries/${r.id}`}">${r.label}</a> <span class="muted">${r.kind === 'decision' ? 'Decision' : 'Financial entry'}</span></li>`)}</ul>`
          : html`<p class="muted">Not cited by any decision or financial entry.</p>`)}
        ${section('History', activityList(listActivity({ entityType: 'document', entityId: d.id, limit: 30 }), { showVenture: false }))}
      </div>
    </div>`;
    return htmlReply(page(ctx, { title: d.title, active: 'documents', body }));
  });

  router.get('/documents/:id/edit', 'write', (ctx) => {
    const d = getDocument(ctx.params.id!) ?? notFound('Document');
    return htmlReply(formPage(ctx, { id: d.id, values: toFormValues(DOCUMENT_FIELDS, d as unknown as Record<string, unknown>) }));
  });
  router.post('/documents/:id', 'write', (ctx) => {
    const d = getDocument(ctx.params.id!) ?? notFound('Document');
    return submit(ctx, DOCUMENT_FIELDS, (values) => {
      updateDocument(d.id, values, ctx.actor);
      ctx.flash('success', 'Document details saved.');
      return redirect(`/documents/${d.id}`);
    }, (values, errors) => formPage(ctx, { id: d.id, values, errors }));
  });

  router.post('/documents/:id/files', 'write', async (ctx) => {
    const d = getDocument(ctx.params.id!) ?? notFound('Document');
    const file = ctx.form.file('file');
    if (!file) ctx.flash('error', 'Choose a file to upload.');
    else {
      try {
        const f = await addFile(d.id, file, ctx.config.uploadDir, ctx.config.maxUploadBytes, ctx.actor);
        ctx.flash('success', `Uploaded “${f.original_name}” as version ${f.version_number}.`);
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        ctx.flash('error', Object.values(err.errors)[0]!);
      }
    }
    return redirect(`/documents/${d.id}`);
  });

  // Authenticated download. Always an attachment, never rendered inline, and
  // sandboxed by CSP in case a browser ignores the disposition.
  router.get('/documents/:id/files/:fileId', 'read', (ctx) => {
    if (!UUID_RE.test(ctx.params.id!) || !UUID_RE.test(ctx.params.fileId!)) notFound('File');
    const f = getFile(ctx.params.id!, ctx.params.fileId!) ?? notFound('File');
    const p = filePath(ctx.config.uploadDir, f.storage_key);
    if (!fs.existsSync(p)) throw new HttpError(404, 'The stored file is missing from the upload directory.');
    const ascii = f.original_name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return {
      status: 200,
      headers: {
        'content-type': f.mime_type,
        'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.original_name)}`,
        'content-security-policy': "sandbox; default-src 'none'",
        'cache-control': 'private, no-store',
      },
      body: fs.readFileSync(p),
    };
  });

  router.post('/documents/:id/verification', 'verify', (ctx) => {
    const d = getDocument(ctx.params.id!) ?? notFound('Document');
    try {
      setDocumentVerification(d.id, ctx.form.get('verification_status'), ctx.actor);
      ctx.flash('success', 'Verification updated.');
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      ctx.flash('error', Object.values(err.errors)[0]!);
    }
    return redirect(`/documents/${d.id}`);
  });

  for (const action of ['archive', 'restore'] as const) {
    router.post(`/documents/:id/${action}`, 'archive', (ctx) => {
      archiveDocument(ctx.params.id!, action === 'archive', ctx.actor);
      return archiveReply(ctx, action === 'archive', 'Document', `/documents/${ctx.params.id}`);
    });
  }
}
