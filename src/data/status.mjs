/**
 * Subsidiary status — the single source of truth for how development stage is
 * labelled anywhere on this site.
 *
 * There is deliberately no `operating` member. Nothing NWPH owns is trading
 * yet, and the count of operating subsidiaries is derived from this enum rather
 * than typed into a template. That makes "0 currently operating" a structural
 * property of the site: it cannot drift out of date, and it cannot be softened
 * by editing copy. Adding an operating company means adding the state here,
 * on purpose, in a reviewed commit.
 */

export const STATUS_VALUES = ['development', 'planned', 'concept'];

export const STATUS = {
  development: {
    value: 'development',
    label: 'In development',
    short: 'In development',
    description: 'Active work is underway: incorporation, licensing, financing or crew.',
    rank: 1,
  },
  planned: {
    value: 'planned',
    label: 'Planned',
    short: 'Planned',
    description: 'Committed to the portfolio, but work has not begun.',
    rank: 2,
  },
  concept: {
    value: 'concept',
    label: 'Concept',
    short: 'Concept',
    description: 'Identified as a gap worth filling. Nothing beyond that.',
    rank: 3,
  },
};

/** No status in this enum means trading. Kept as a function so callers read intent. */
export const isOperating = () => false;

export const statusMeta = (value) => {
  const meta = STATUS[value];
  if (!meta) throw new Error(`Unknown subsidiary status: ${JSON.stringify(value)}`);
  return meta;
};

/** Count of subsidiaries currently trading. Derived, never authored. */
export const operatingCount = (subsidiaries) => subsidiaries.filter((s) => isOperating(s.status)).length;

export const countByStatus = (subsidiaries) =>
  STATUS_VALUES.map((value) => ({
    ...STATUS[value],
    count: subsidiaries.filter((s) => s.status === value).length,
  }));
