/**
 * Site-wide configuration. Everything an editor might need to change without
 * touching a template lives here or in src/content/.
 */

export const site = {
  name: 'North West Passage Holdings Corporation',
  shortName: 'NWPH',
  // Update to the production origin before launch — used for canonical URLs,
  // Open Graph tags and the sitemap.
  origin: 'https://nwph.ca',
  // GitHub Pages project sites are served from a subpath. Leave as '' for a
  // custom domain or a user/organisation site.
  base: '',
  locale: 'en-CA',
  description:
    'North West Passage Holdings Corporation is an Inuit-owned holding company building and operating companies in sectors where Nunavummiut have no locally-owned alternative.',
  headquarters: 'Iqaluit, Nunavut, Canada',
  email: 'info@nwph.ca',
  founded: '2025',
};

/**
 * Form endpoint.
 *
 * GitHub Pages serves static files only, so it cannot validate a submission.
 * Set this to a POST endpoint that can — see README "Forms". The repository
 * ships a ready-to-deploy handler at tools/form-worker.js which implements the
 * server-side half (validation, honeypot, timing check, rate limit).
 *
 * While this is null the forms render in a clearly-labelled unavailable state
 * with the direct email address instead. They never pretend to submit.
 */
export const formEndpoint = null;

export const nav = [
  { href: '/about/', label: 'About' },
  { href: '/subsidiaries/', label: 'Subsidiaries' },
  { href: '/procurement/', label: 'Procurement' },
  { href: '/careers/', label: 'Careers' },
  { href: '/news/', label: 'Updates' },
  { href: '/contact/', label: 'Contact' },
];

export const footerNav = [
  { href: '/subsidiaries/', label: 'Subsidiaries' },
  { href: '/procurement/', label: 'Suppliers' },
  { href: '/careers/', label: 'Careers' },
  { href: '/news/', label: 'Updates' },
  { href: '/contact/', label: 'Contact' },
];
