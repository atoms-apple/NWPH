/**
 * Every status and category vocabulary in one place, so the same words mean
 * the same thing on every screen. Values match the CHECK constraints in
 * migrations/001_initial.sql.
 */

export interface Option {
  value: string;
  label: string;
  description?: string;
}

const opts = (pairs: ReadonlyArray<readonly [string, string, string?]>): Option[] =>
  pairs.map(([value, label, description]) => ({ value, label, description }));

export const labelOf = (options: ReadonlyArray<Option>, value: string | null | undefined): string =>
  options.find((o) => o.value === value)?.label ?? (value || '—');

export const LEGAL_STATUSES = opts([
  ['unverified', 'Not verified', 'Legal status has not been confirmed and recorded.'],
  ['not_established', 'Not established', 'No legal entity exists.'],
  ['in_formation', 'In formation', 'Registration or incorporation is under way.'],
  ['established', 'Established (user-recorded)', 'An entity exists, as recorded by a user. Not independently verified by NWPH OS.'],
  ['dissolved', 'Dissolved'],
  ['other', 'Other (see detail)'],
]);

export const OPERATIONAL_STATUSES = opts([
  ['proposed', 'Proposed', 'An idea or plan. Not trading.'],
  ['in_development', 'In development', 'Being actively developed. Not trading.'],
  ['operational', 'Operational', 'Trading or delivering services.'],
  ['paused', 'Paused'],
  ['discontinued', 'Discontinued'],
]);

export const VENTURE_CATEGORIES = [
  'To be determined',
  'Logistics & Freight',
  'Transportation',
  'Tourism & Expeditions',
  'Retail & Supply',
  'Technology & Communications',
  'Real Estate & Construction',
  'Financial Services',
  'Energy',
  'Food & Country Food',
  'Professional Services',
  'Other',
];

export const PROJECT_STATUSES = opts([
  ['planned', 'Planned'],
  ['active', 'Active'],
  ['on_hold', 'On hold'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]);

export const TASK_STATUSES = opts([
  ['not_started', 'Not started'],
  ['in_progress', 'In progress'],
  ['blocked', 'Blocked'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]);

export const TASK_PRIORITIES = opts([
  ['low', 'Low'],
  ['normal', 'Normal'],
  ['high', 'High'],
  ['critical', 'Critical'],
]);

export const MILESTONE_STATUSES = opts([
  ['planned', 'Planned'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]);

export const DECISION_STATUSES = opts([
  ['proposed', 'Proposed', 'An idea put forward. Not decided.'],
  ['under_review', 'Under review', 'Being considered. Not decided.'],
  ['approved', 'Approved', 'Decided in favour.'],
  ['rejected', 'Rejected', 'Decided against.'],
  ['deferred', 'Deferred', 'Set aside for later.'],
  ['superseded', 'Superseded', 'Replaced by a later decision.'],
]);

export const DECISION_CATEGORIES = [
  'Strategy',
  'Governance',
  'Finance',
  'Legal & Corporate',
  'Operations',
  'Partnerships',
  'People',
  'Technology',
  'Community',
  'Other',
];

export const DOCUMENT_CATEGORIES = [
  'Business Plans',
  'Market Research',
  'Financial Planning',
  'Contracts',
  'Policies',
  'Technical Documentation',
  'Funding Applications',
  'Government Publications',
  'Meeting Notes',
  'Legal and Corporate Records',
  'General Research',
];

export const RESEARCH_CATEGORIES = ['Market Research', 'General Research', 'Government Publications'];

export const DOCUMENT_VERIFICATION = opts([
  ['unverified', 'Unverified', 'Content and source not yet checked.'],
  ['verified', 'Verified', 'Source and content checked by an owner.'],
  ['outdated', 'Outdated', 'Superseded or no longer reliable.'],
]);

export const OPPORTUNITY_CATEGORIES = [
  'Grant',
  'Loan or financing',
  'Procurement',
  'Partnership',
  'Contract',
  'Research funding',
  'Training funding',
  'Other',
];

export const OPPORTUNITY_STATUSES = opts([
  ['identified', 'Identified'],
  ['researching', 'Researching'],
  ['eligible', 'Eligible (confirmed)', 'Eligibility confirmed by a person, with the basis recorded.'],
  ['in_preparation', 'In preparation'],
  ['submitted', 'Submitted'],
  ['awarded', 'Awarded'],
  ['unsuccessful', 'Unsuccessful'],
  ['expired', 'Expired'],
  ['not_pursuing', 'Not pursuing'],
]);

/** Statuses that assert eligibility, and so require a recorded basis. */
export const ELIGIBILITY_ASSERTING = new Set(['eligible', 'in_preparation', 'submitted', 'awarded']);
export const OPPORTUNITY_CLOSED = new Set(['awarded', 'unsuccessful', 'expired', 'not_pursuing']);

export const RISK_CATEGORIES = [
  'Financial',
  'Regulatory & Legal',
  'Operational',
  'Market',
  'Logistics & Supply',
  'Environmental & Climate',
  'People & Capacity',
  'Community & Reputation',
  'Technology',
  'Other',
];

export const RISK_STATUSES = opts([
  ['open', 'Open'],
  ['monitoring', 'Monitoring'],
  ['mitigated', 'Mitigated'],
  ['occurred', 'Occurred'],
  ['closed', 'Closed'],
]);
export const RISK_ACTIVE = new Set(['open', 'monitoring', 'occurred']);

export const LIKELIHOOD = opts([
  ['1', '1 — Rare'],
  ['2', '2 — Unlikely'],
  ['3', '3 — Possible'],
  ['4', '4 — Likely'],
  ['5', '5 — Almost certain'],
]);

export const IMPACT = opts([
  ['1', '1 — Negligible'],
  ['2', '2 — Minor'],
  ['3', '3 — Moderate'],
  ['4', '4 — Major'],
  ['5', '5 — Severe'],
]);

/** Coarse band from two ordinal ratings. A planning aid, not a prediction. */
export function riskBand(likelihood: number, impact: number): { band: 'low' | 'medium' | 'high'; label: string } {
  const score = likelihood * impact;
  if (score >= 12 || impact === 5) return { band: 'high', label: 'High' };
  if (score >= 6) return { band: 'medium', label: 'Medium' };
  return { band: 'low', label: 'Low' };
}

export const ENTRY_TYPES = opts([
  ['startup_cost', 'Startup cost', 'One-time cost of getting the venture started.'],
  ['capital_expenditure', 'Capital expenditure', 'Equipment, vehicles, buildings or other long-lived assets.'],
  ['operating_expense', 'Operating expense', 'Recurring cost of running the venture, for the stated period.'],
  ['revenue', 'Revenue', 'Income from sales or services, for the stated period.'],
  ['funding_requirement', 'Funding requirement', 'Money that must be raised. Never an actual.'],
  ['funding', 'Funding source', 'A grant, loan, investment or other source. Its status says whether it is secured.'],
]);

export const BASES = opts([
  ['forecast', 'Forecast', 'An estimate or assumption about the future.'],
  ['budget', 'Budget', 'An amount planned or allocated.'],
  ['actual', 'Actual', 'A real amount that has occurred, as entered by a user.'],
]);

export const FUNDING_STATUSES = opts([
  ['potential', 'Potential', 'Identified only. Not applied for, not secured.'],
  ['applied', 'Applied', 'Application made. Not secured.'],
  ['committed', 'Committed', 'Formally confirmed in writing, not yet received.'],
  ['received', 'Received', 'Money received. Recorded as an actual.'],
  ['declined', 'Declined', 'Refused or withdrawn.'],
]);
export const FUNDING_SECURED = new Set(['committed', 'received']);

export const FINANCE_VERIFICATION = opts([
  ['unverified', 'Entered (unverified)'],
  ['verified', 'Verified'],
]);

export const FINANCE_CATEGORIES = [
  'Equipment',
  'Vehicles',
  'Facilities & rent',
  'Fuel & energy',
  'Shipping & freight',
  'Insurance',
  'Licensing & permits',
  'Legal & professional',
  'Wages & contractors',
  'Training',
  'Technology',
  'Marketing',
  'Travel',
  'Working capital',
  'Sales',
  'Services',
  'Grant',
  'Loan',
  'Equity',
  'Other',
];

export const DEPENDENCY_EXTERNAL = opts([
  ['funding', 'Funding decision'],
  ['supplier', 'Supplier'],
  ['approval', 'Approval, licence or permit'],
  ['partner', 'Partner or community agreement'],
  ['other', 'Other external condition'],
]);

export const DEPENDENCY_STATUSES = opts([
  ['open', 'Open'],
  ['resolved', 'Resolved'],
]);
