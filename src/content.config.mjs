/**
 * Content schemas. Every collection is validated at build time; a violation
 * fails the build with the offending file and field named.
 */

import { string, number, boolean, enumOf, arrayOf, isoDate, object } from './lib/schema.mjs';
import { STATUS_VALUES } from './data/status.mjs';

export const subsidiarySchema = object({
  name: string({ min: 2, max: 60 }),
  legalName: string({ min: 2, max: 90 }),
  sector: string({ min: 2, max: 40 }),
  // The load-bearing field. See src/data/status.mjs.
  status: enumOf(STATUS_VALUES),
  summary: string({ min: 20, max: 400 }),
  target: string({ optional: true, max: 60 }),
  order: number({ optional: true, integer: true }),
  slug: string({ optional: true }),
  draft: boolean(),
});

export const personSchema = object({
  name: string({ min: 2, max: 60 }),
  role: string({ min: 2, max: 80 }),
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

export const newsSchema = object({
  title: string({ min: 5, max: 120 }),
  date: isoDate(),
  summary: string({ min: 20, max: 300 }),
  slug: string({ optional: true }),
  draft: boolean(),
});

const byOrder = (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name?.localeCompare(b.name ?? '') || 0;

export const collections = {
  subsidiaries: { schema: subsidiarySchema, sort: byOrder },
  people: { schema: personSchema, sort: byOrder },
  roles: { schema: roleSchema, sort: (a, b) => (a.order ?? 999) - (b.order ?? 999) },
  procurement: { schema: procurementTierSchema, sort: (a, b) => (a.order ?? 999) - (b.order ?? 999) },
  faq: { schema: faqSchema, sort: (a, b) => (a.order ?? 999) - (b.order ?? 999) },
  news: { schema: newsSchema, sort: (a, b) => b.date.localeCompare(a.date) },
};
