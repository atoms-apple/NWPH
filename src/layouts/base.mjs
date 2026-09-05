import { html, raw, render } from '../lib/html.mjs';
import { site, demo } from '../data/site.mjs';
import { SiteHeader, SiteFooter } from '../components/chrome.mjs';

/**
 * Organization structured data.
 *
 * Deliberately minimal: name, address, contact and a description. No employee
 * counts, no founding claims beyond what is on the page, no subsidiary list —
 * marking up companies that do not exist yet as subOrganization would assert
 * something untrue to search engines.
 */
const organizationJsonLd = () => JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: site.name,
  alternateName: site.shortName,
  url: site.origin + site.base + '/',
  description: site.description,
  email: site.email,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Iqaluit',
    addressRegion: 'NU',
    addressCountry: 'CA',
  },
});

export const BaseLayout = ({
  title, description, path, body, current, stats = { operating: 0, total: 0 }, noindex = false,
}) => {
  const base = site.base;
  const canonical = `${site.origin}${base}${path}`;
  const fullTitle = path === '/' ? `${site.name} — Inuit-owned holding company, Nunavut` : `${title} · ${site.shortName}`;

  return render(html`<!DOCTYPE html>
<html lang="en-CA">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${fullTitle}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${canonical}" />
${noindex || demo.enabled ? raw('<meta name="robots" content="noindex, nofollow" />') : ''}

<meta property="og:type" content="website" />
<meta property="og:site_name" content="${site.name}" />
<meta property="og:title" content="${fullTitle}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:locale" content="en_CA" />
<meta name="twitter:card" content="summary" />

<link rel="icon" href="${base}/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="${base}/assets/site.css" />
<script type="application/ld+json">${raw(organizationJsonLd())}</script>
</head>
<body${demo.enabled ? raw(' class="is-demo"') : raw('')}>
<a class="skip-link" href="#main">Skip to main content</a>
${demo.enabled ? html`
<div class="demo-banner" role="note">
  <div class="wrap demo-banner__inner">
    <strong>Demonstration build</strong>
    <span>${demo.banner}</span>
  </div>
</div>` : ''}
${SiteHeader({ current, base })}
<main id="main">
${body}
</main>
${SiteFooter({ base, operating: stats.operating, total: stats.total })}
<script src="${base}/assets/enhance.js" defer></script>
</body>
</html>`);
};
