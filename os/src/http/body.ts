import type { IncomingMessage } from 'node:http';
import { HttpError, FormInput } from './context.ts';

const FORM_LIMIT = 1024 * 1024; // urlencoded forms: 1 MiB

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > limit) throw new HttpError(413, 'The submission is too large.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'The submission is too large.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Parse a form body. Multipart parsing uses the platform's own Fetch API
 * implementation (Request.formData), so there is no hand-written multipart
 * parser to get wrong.
 */
export async function parseForm(req: IncomingMessage, maxUploadBytes: number): Promise<FormInput> {
  const type = String(req.headers['content-type'] || '').toLowerCase();
  if (type.startsWith('multipart/form-data')) {
    const body = await readBody(req, maxUploadBytes + 256 * 1024);
    try {
      const request = new Request('http://internal/', {
        method: 'POST',
        headers: { 'content-type': String(req.headers['content-type']) },
        body: new Blob([new Uint8Array(body)]),
      });
      return new FormInput(await request.formData());
    } catch {
      throw new HttpError(400, 'The upload could not be read. Please try again.');
    }
  }
  if (type.startsWith('application/x-www-form-urlencoded') || type === '') {
    const body = await readBody(req, FORM_LIMIT);
    const data = new FormData();
    for (const [k, v] of new URLSearchParams(body.toString('utf8'))) data.append(k, v);
    return new FormInput(data);
  }
  throw new HttpError(415, 'Unsupported content type.');
}
