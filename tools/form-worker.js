/**
 * Server-side form handler — the half GitHub Pages cannot provide.
 *
 * Deploy to Cloudflare Workers (or adapt: it is a standard fetch handler), then
 * set `formEndpoint` in src/data/site.mjs to its URL. Until that is done the
 * site renders an email fallback instead of a form, rather than a form that
 * silently discards submissions.
 *
 *   npx wrangler deploy tools/form-worker.js
 *
 * Required secrets:
 *   MAIL_TO         destination inbox
 *   RESEND_API_KEY  or adapt deliver() to any SMTP/API provider
 * Optional binding:
 *   RATE_LIMIT      a KV namespace; without it, rate limiting is skipped
 *
 * Client-side validation in src/client/enhance.js mirrors these rules. This is
 * the enforcement point; that one is a convenience.
 */

const ALLOWED_ORIGINS = ['https://nwph.ca', 'https://www.nwph.ca'];

// Must stay in step with the forms in src/components/forms.mjs.
const SCHEMAS = {
  supplier: {
    organisation: { required: true, max: 120 },
    name: { required: true, max: 100 },
    email: { required: true, max: 200, email: true },
    phone: { max: 40 },
    community: { max: 80 },
    inuit_firm: { max: 40 },
    goods_services: { required: true, min: 20, max: 2000 },
  },
  partnership: {
    organisation: { required: true, max: 120 },
    name: { required: true, max: 100 },
    email: { required: true, max: 200, email: true },
    interest: { required: true, max: 80 },
    message: { required: true, min: 20, max: 3000 },
  },
  'career-interest': {
    name: { required: true, max: 100 },
    email: { required: true, max: 200, email: true },
    community: { max: 80 },
    beneficiary: { max: 40 },
    area: { required: true, min: 10, max: 1500 },
    experience: { max: 2000 },
  },
  'document-request': {
    organisation: { required: true, max: 120 },
    name: { required: true, max: 100 },
    email: { required: true, max: 200, email: true },
    documents: { required: true, min: 15, max: 2000 },
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(kind, data) {
  const schema = SCHEMAS[kind];
  if (!schema) return { errors: ['Unknown form.'], clean: {} };

  const errors = [];
  const clean = {};

  for (const [field, rule] of Object.entries(schema)) {
    const value = String(data.get(field) ?? '').trim();
    if (!value) {
      if (rule.required) errors.push(`${field} is required.`);
      continue;
    }
    if (rule.max && value.length > rule.max) { errors.push(`${field} is too long.`); continue; }
    if (rule.min && value.length < rule.min) { errors.push(`${field} is too short.`); continue; }
    if (rule.email && !EMAIL.test(value)) { errors.push(`${field} is not a valid email address.`); continue; }
    clean[field] = value;
  }

  // Reject any field the schema does not declare.
  for (const key of data.keys()) {
    if (['form', '_redirect', 'elapsed', 'company_url'].includes(key)) continue;
    if (!(key in schema)) errors.push(`Unexpected field: ${key}.`);
  }

  return { errors, clean };
}

async function rateLimited(env, ip) {
  if (!env.RATE_LIMIT || !ip) return false;
  const key = `rl:${ip}`;
  const count = Number((await env.RATE_LIMIT.get(key)) ?? 0);
  if (count >= 5) return true;
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 3600 });
  return false;
}

async function deliver(env, kind, clean) {
  const lines = Object.entries(clean).map(([key, value]) => `${key}: ${value}`).join('\n');
  const body = `New ${kind} submission from nwph.ca\n\n${lines}\n`;

  // Swap this block for SMTP or another provider as preferred; nothing else
  // in the handler depends on how delivery happens.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'NWPH website <forms@nwph.ca>',
      to: [env.MAIL_TO],
      reply_to: clean.email,
      subject: `[nwph.ca] ${kind} — ${clean.organisation || clean.name}`,
      text: body,
    }),
  });
  if (!response.ok) throw new Error(`delivery failed: ${response.status}`);
}

const redirect = (url, status) => new Response(null, { status: 303, headers: { location: `${url}${status}` } });

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const origin = request.headers.get('origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });

    const data = await request.formData();
    const kind = String(data.get('form') ?? '');
    const back = String(data.get('_redirect') ?? ALLOWED_ORIGINS[0] + '/thank-you/');

    // Only redirect to our own site — never to an attacker-supplied host.
    let target;
    try {
      target = new URL(back);
      if (!ALLOWED_ORIGINS.includes(target.origin)) throw new Error('bad origin');
    } catch {
      target = new URL(ALLOWED_ORIGINS[0] + '/thank-you/');
    }

    // Honeypot: a hidden field a person never sees and never fills.
    // Answer 303 as though it succeeded so the bot learns nothing.
    if (String(data.get('company_url') ?? '')) return redirect(target.href, '');

    // Timing check: a genuine form takes longer than three seconds to complete.
    if (Number(data.get('elapsed') ?? 0) < 3) return redirect(target.href, '');

    const ip = request.headers.get('cf-connecting-ip');
    if (await rateLimited(env, ip)) {
      return redirect(ALLOWED_ORIGINS[0] + '/contact/', '?error=rate-limit');
    }

    const { errors, clean } = validate(kind, data);
    if (errors.length) {
      return redirect(ALLOWED_ORIGINS[0] + '/contact/', '?error=validation');
    }

    try {
      await deliver(env, kind, clean);
    } catch {
      return redirect(ALLOWED_ORIGINS[0] + '/contact/', '?error=delivery');
    }

    return redirect(target.href, '');
  },
};
