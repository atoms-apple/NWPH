/**
 * Site-wide configuration. Everything an editor might need to change without
 * touching a template lives here or in src/content/.
 */

export const site = {
  name: 'North West Passage Holdings Corporation',
  shortName: 'NWPH',
  // Used for canonical URLs, Open Graph tags and the sitemap.
  // Moving to the nwph.ca custom domain later means setting origin to
  // 'https://nwph.ca', base to '', and adding a public/CNAME file.
  origin: 'https://atoms-apple.github.io',
  // GitHub Pages serves this repository from a subpath. Every link and asset is
  // prefixed with it — an empty value here 404s the whole site on a project URL.
  // Overridable so one Pages site can host the factual build at /NWPH/ and the
  // demonstration build at /NWPH/demo/ from the same workflow.
  base: process.env.SITE_BASE ?? '/NWPH',
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
  { href: '/subsidiaries/', label: 'Portfolio' },
  { href: '/procurement/', label: 'Procurement' },
  { href: '/careers/', label: 'Careers' },
  { href: '/news/', label: 'Updates' },
  { href: '/contact/', label: 'Contact' },
];

/** Footer directory, grouped the way a corporate site directs its readers. */
export const footerNav = [
  {
    heading: 'Corporation',
    links: [
      { href: '/about/', label: 'About & mission' },
      { href: '/about/governance/', label: 'Governance' },
      { href: '/reports/', label: 'Reporting & documents' },
      { href: '/news/', label: 'Updates' },
    ],
  },
  {
    heading: 'Portfolio',
    links: [
      { href: '/subsidiaries/', label: 'All ventures' },
      { href: '/subsidiaries/arctrek-expeditions/', label: 'ArcTrek Expeditions' },
    ],
  },
  {
    heading: 'Working with us',
    links: [
      { href: '/procurement/', label: 'Suppliers & procurement' },
      { href: '/careers/', label: 'Careers' },
      { href: '/contact/', label: 'Contact' },
    ],
  },
  {
    heading: 'Policies',
    links: [
      { href: '/privacy/', label: 'Privacy notice' },
      { href: '/accessibility/', label: 'Accessibility' },
    ],
  },
];
