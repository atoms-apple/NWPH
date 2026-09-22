/**
 * Site-wide configuration. Everything an editor might need to change without
 * touching a template lives here or in src/content/.
 */

/**
 * FUTURE-STATE MODEL.
 *
 * This branch renders North West Passage Holdings Corporation as a newly-formed
 * corporation in its early operating years: incorporated, one company trading a
 * second season, a second just launched, and the rest still ahead of it.
 *
 * It is a vision model, not a record. NWPH is pre-incorporation today and none
 * of this has happened. The figures are deliberately small and concrete — a
 * young company's numbers, not an established one's — because the point is to
 * show a plausible near future rather than an aspirational far one.
 *
 * People use the standard legal fictitious-person names (Doe, Roe, Major,
 * Stiles). Nunavut has roughly 40,000 residents, and a plausible generated name
 * has a real chance of matching someone who would then appear publicly as a
 * director of a company they have never heard of.
 *
 * Setting enabled to false returns this to the factual build on `main`.
 */
export const demo = {
  enabled: true,
  founded: 2026,
  /** The year the model is set in. */
  year: 2028,
  bannerLabel: 'Future-state model',
  banner:
    'Illustrative future-state model — how NWPH could look in its early operating years. The corporation is pre-incorporation today.',

  /** Illustrative figures for a young corporation. One place, kept consistent. */
  figures: {
    employees: 23,
    inuitEmployment: '74%',
    revenue: '$2.4M',
    communities: 3,
    apprentices: 4,
    scholarships: 2,
    procurementLocal: '$610,000',
    yearEnd: '31 March',
  },
};

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
  { href: '/about/history/', label: 'History' },
  { href: '/subsidiaries/', label: 'Portfolio' },
  { href: '/procurement/', label: 'Procurement' },
  { href: '/careers/', label: 'Careers' },
  { href: '/community/', label: 'Community' },
  { href: '/news/', label: 'News' },
  { href: '/contact/', label: 'Contact' },
];

/** Footer directory, grouped the way a corporate site directs its readers. */
export const footerNav = [
  {
    heading: 'Corporation',
    links: [
      { href: '/about/', label: 'About & mission' },
      { href: '/about/governance/', label: 'Governance' },
      { href: '/about/leadership/', label: 'Leadership & board' },
      { href: '/about/history/', label: 'History' },
      { href: '/reports/', label: 'Reports & documents' },
    ],
  },
  {
    heading: 'Portfolio',
    links: [
      { href: '/subsidiaries/', label: 'All companies' },
      { href: '/news/', label: 'News' },
      { href: '/community/', label: 'Community' },
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
