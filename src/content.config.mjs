/**
 * Content schemas. Every collection is validated at build time; a violation
 * fails the build with the offending file and field named.
 */

import { string, number, boolean, enumOf, arrayOf, isoDate, object } from './lib/schema.mjs';
import { STATUS_VALUES } from './data/status.mjs';

/**
 * A venture in the portfolio.
 *
 * `name` and `legalName` are optional on purpose. A venture that is not yet
 * incorporated is published by sector only — naming a company before it exists
 * invites the reader to assume it does. Only named ventures get a detail page.
 */
export const subsidiarySchema = object({
  name: string({ optional: true, min: 2, max: 60 }),
  legalName: string({ optional: true, min: 2, max: 90 }),
  sector: string({ min: 2, max: 48 }),
  // The load-bearing field. See src/data/status.mjs.
  status: enumOf(STATUS_VALUES),
  summary: string({ min: 20, max: 400 }),
  target: string({ optional: true, max: 60 }),
  founded: number({ optional: true, integer: true }),
  managingDirector: string({ optional: true, max: 60 }),
  staff: string({ optional: true, max: 40 }),
  communities: string({ optional: true, max: 60 }),
  order: number({ optional: true, integer: true }),
  slug: string({ optional: true }),
  draft: boolean(),
});

export const personSchema = object({
  name: string({ min: 2, max: 60 }),
  role: string({ min: 2, max: 80 }),
  // Which listing the person belongs to. Absent means the founding group.
  group: enumOf(['board', 'executive', 'subsidiary'], { optional: true }),
  // Subsidiary the person leads, for group: subsidiary.
  venture: string({ optional: true, max: 60 }),
  appointed: number({ optional: true, integer: true }),
  independent: boolean(),
  order: number({ optional: true, integer: true }),
  slug: string({ optional: true }),
  draft: boolean(),
});

export const roleSchema = object({
  title: string({ min: 2, max: 80 }),
  subsidiary: string({ optional: true, max: 60 }),
  location: string({ min: 2, max: 60 }),
  type: string({ min: 2, max: 40 }),
  closes: isoDate({ optional: true }),
  order: number({ optional: true, integer: true }),
  slug: string({ optional: true }),
  draft: boolean(),
});

export const procurementTierSchema = object({
  title: string({ min: 2, max: 80 }),
  timing: string({ optional: true, max: 80 }),
  categories: arrayOf(string(), { optional: true }),
  order: number({ optional: true, integer: true }),
  slug: string({ optional: true }),
  draft: boolean(),
});

export const faqSchema = object({
  question: string({ min: 5, max: 200 }),
  order: number({ optional: true, integer: true }),
  slug: string({ optional: true }),
  draft: boolean(),
});

/** A step that must be completed before a named venture can operate. */
export const milestoneSchema = object({
  title: string({ min: 5, max: 120 }),
  venture: string({ min: 2, max: 60 }),
  // Left unset until it can be stated accurately. An unset step renders as a
  // required step with no progress claimed, which is the honest default.
  state: enumOf(['not-started', 'underway', 'complete'], { optional: true }),
  order: number({ integer: true }),
  slug: string({ optional: true }),
  draft: boolean(),
});

/** A dated entry in the corporate history. */
export const historySchema = object({
  year: number({ integer: true }),
  title: string({ min: 5, max: 120 }),
  order: number({ optional: true, integer: true }),
  slug: string({ optional: true }),
  draft: boolean(),
});

export const newsSchema = object({
  title: string({ min: 5, max: 120 }),
  date: isoDate(),
  summary: string({ min: 20, max: 300 }),
  slug: string({ optional: true }),
  draft: boolean(),
});

const byOrder = (a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.name ?? a.sector ?? '').localeCompare(b.name ?? b.sector ?? '');

export const collections = {
  subsidiaries: { schema: subsidiarySchema, sort: byOrder },
  people: { schema: personSchema, sort: byOrder },
  roles: { schema: roleSchema, sort: (a, b) => (a.order ?? 999) - (b.order ?? 999) },
  procurement: { schema: procurementTierSchema, sort: (a, b) => (a.order ?? 999) - (b.order ?? 999) },
  faq: { schema: faqSchema, sort: (a, b) => (a.order ?? 999) - (b.order ?? 999) },
  milestones: { schema: milestoneSchema, sort: (a, b) => a.order - b.order },
  history: { schema: historySchema, sort: (a, b) => a.year - b.year },
  news: { schema: newsSchema, sort: (a, b) => b.date.localeCompare(a.date) },
};
