/**
 * Cargo, charter, groups and careers.
 *
 * Freight is not a sideline on this network — it is why several of these
 * services exist at all, and on the combi it shares the airframe with the
 * passengers. So it is modelled properly: classes, rates, dimensional weight,
 * and the dangerous-goods rules that actually bite up here.
 */

/* ── Cargo ───────────────────────────────────────────────────────────────── */

/**
 * Freight classes.
 *
 * `rate` is dollars per chargeable kilogram, `minimum` the smallest charge for a
 * shipment of that class. Perishables and dangerous goods cost more because
 * they constrain how and when the aircraft can be loaded, not because they
 * weigh more.
 */
export const cargoClasses = [
  {
    id: 'general',
    name: 'General freight',
    rate: 3.15,
    minimum: 45,
    detail: 'Boxed goods, parts, supplies, household items.',
    lead: 'Tendered up to two hours before departure at the hubs, four hours elsewhere.',
  },
  {
    id: 'priority',
    name: 'Priority freight',
    rate: 5.40,
    minimum: 85,
    detail: 'First on the next available service, ahead of general freight.',
    lead: 'Tendered up to one hour before departure. Carried on the first aircraft with capacity.',
  },
  {
    id: 'country-food',
    name: 'Country food',
    rate: 2.40,
    minimum: 38,
    detail:
      'Harvested meat and fish moving between communities, in sealed leak-proof coolers. '
      + 'Rated below general freight deliberately.',
    lead: 'Kept frozen where the routing allows. Carried at the shipper’s risk on a multi-stop circuit.',
  },
  {
    id: 'perishable',
    name: 'Perishable and chilled',
    rate: 4.80,
    minimum: 70,
    detail: 'Fresh produce, dairy, pharmacy stock. Held in a heated hold and loaded last.',
    lead: 'Booked at least 24 hours ahead so the load plan can protect it.',
  },
  {
    id: 'mail',
    name: 'Mail and courier',
    rate: 3.80,
    minimum: 30,
    detail: 'Contract mail and courier consolidations.',
    lead: 'Tendered to the schedule agreed in the contract.',
  },
  {
    id: 'dangerous',
    name: 'Dangerous goods',
    rate: 7.90,
    minimum: 180,
    detail:
      'Fuel, compressed gas, batteries over 160 Wh, explosives for seismic or avalanche work. '
      + 'Declared, documented and accepted only on services cleared to carry them.',
    lead: 'Booked at least 72 hours ahead. Shipper’s declaration required before tender.',
    restricted: true,
  },
  {
    id: 'livestock',
    name: 'Live animals',
    rate: 6.20,
    minimum: 140,
    detail: 'Dogs, and sled teams moving between communities, in approved kennels in the heated hold.',
    lead: 'Booked 48 hours ahead. Not carried where the routing exceeds six hours door to door.',
  },
];

export const cargoClassById = Object.fromEntries(cargoClasses.map((c) => [c.id, c]));

/**
 * Dimensional weight divisor.
 *
 * Air freight charges on whichever is greater, actual mass or the volume the
 * shipment occupies. 6,000 cm³/kg is the standard divisor and is what makes a
 * box of insulation cost more than its weight suggests.
 */
export const DIM_DIVISOR = 6000;

/** Surcharges applied on top of the class rate. */
export const cargoSurcharges = [
  { id: 'remote', name: 'Small-community surcharge', note: 'Applies where either end is served only by the Twin Otter or King Air.', rate: 0.35 },
  { id: 'circuit', name: 'Circuit routing', note: 'Applies where the shipment must ride a multi-stop circuit.', rate: 0.15 },
  { id: 'oversize', name: 'Oversize handling', note: 'Any single piece over 150 cm in its longest dimension.', flat: 60 },
];

/* ── Charter ─────────────────────────────────────────────────────────────── */

/**
 * Charter rates, by the block hour.
 *
 * Positioning is the reality of charter in the North: the aircraft has to get
 * to you and home again, and unless it is already where you are, you pay for
 * that time too. Each type carries the base it actually sits at, so a Twin
 * Otter chartered out of Resolute does not bill eleven hours of positioning
 * from Iqaluit.
 */
export const charterAircraft = [
  {
    id: 'kingair350',
    base: 'YFB',
    hourly: 4200,
    minHours: 2,
    positioning: true,
    uses: ['Medical transfer', 'Government and corporate travel', 'Survey and inspection'],
    note: 'Nine seats, pressurised, fast. The usual choice for a medical transfer or a day of meetings in two communities.',
  },
  {
    id: 'dhc6-300',
    // Based at Resolute, where the High Arctic work is. Chartering it out of
    // Iqaluit means paying for it to fly north first.
    base: 'YRB',
    hourly: 3400,
    minHours: 2,
    positioning: true,
    uses: ['Camp support', 'Outpost and cabin access', 'Short-strip community travel'],
    note: 'Nineteen seats and the shortest field performance on the fleet. Goes where nothing else does.',
  },
  {
    id: 'dash8-100',
    base: 'YFB',
    hourly: 6800,
    minHours: 3,
    positioning: true,
    uses: ['Community group travel', 'Sports teams and delegations', 'Combined passenger and freight'],
    note: 'Thirty-seven seats with a freight compartment, on gravel.',
  },
  {
    id: 'atr42-500',
    base: 'YRT',
    hourly: 8200,
    minHours: 3,
    positioning: true,
    uses: ['Large groups', 'Rotational crew changes'],
    note: 'Forty-eight seats. Needs 1,100 m, so it cannot reach the shortest strips.',
  },
  {
    id: 'b737-700c',
    base: 'YFB',
    hourly: 19500,
    minHours: 4,
    positioning: true,
    uses: ['Heavy freight', 'Mine and project rotations', 'Large-scale movement south'],
    note: 'The combi. Twelve tonnes of freight, or seventy-eight seats, or a bulkhead somewhere between.',
  },
];

export const charterPurposes = [
  { id: 'medical', name: 'Medical transfer' },
  { id: 'camp', name: 'Camp or outpost support' },
  { id: 'community', name: 'Community or group travel' },
  { id: 'corporate', name: 'Corporate, government or project' },
  { id: 'freight', name: 'Freight movement' },
  { id: 'survey', name: 'Survey, inspection or research' },
  { id: 'other', name: 'Something else' },
];

/* ── Groups ──────────────────────────────────────────────────────────────── */

export const groupTravel = {
  minimum: 10,
  deposit: 0.2,
  holdDays: 21,
  nameDeadlineDays: 14,
  benefits: [
    'A fare held for the whole party, so late names do not pay a higher price',
    'A 20% deposit holds the booking; the balance is due 14 days before departure',
    'Names may be supplied up to 14 days before departure',
    'One free name change per traveller',
    'Baggage pooled across the party, so one heavy bag does not cost extra',
    'A single point of contact for the booking, and for disruption',
  ],
  kinds: [
    { id: 'sports', name: 'Sports team or tournament' },
    { id: 'school', name: 'School or youth group' },
    { id: 'conference', name: 'Conference or meeting' },
    { id: 'community', name: 'Community or cultural travel' },
    { id: 'work', name: 'Work crew or rotation' },
    { id: 'family', name: 'Family gathering or funeral' },
  ],
};

/* ── Careers ─────────────────────────────────────────────────────────────── */

/**
 * Open roles.
 *
 * These describe what an airline on this network would actually need to hire,
 * and the terms it would have to offer to get anyone to take it — northern
 * allowance, subsidised housing, and rotations that let a southern hire go home.
 */
export const roles = [
  {
    id: 'first-officer-dash8',
    title: 'First Officer — Dash 8-100',
    team: 'Flight Operations',
    base: 'Iqaluit',
    type: 'Full time',
    salary: '$78,000 – $96,000',
    closes: 'Open until filled',
    summary:
      'Right seat on the Baffin circuits. Gravel strips, short fields, and the weather that comes '
      + 'with them — the best line flying available anywhere for building real command experience.',
    requirements: [
      'Commercial Pilot Licence with Group 1 instrument rating',
      '1,500 hours total, 500 multi-engine',
      'Canadian citizenship or permanent residence',
      'Ability to hold a Transport Canada Category 1 medical',
    ],
    offered: [
      'Type training provided',
      'Northern living allowance and subsidised housing in Iqaluit',
      'Four weeks on, two weeks off, with travel home included',
      'Upgrade path to Captain, typically within three years',
    ],
    priority: 'Preference given to Nunavut Agreement beneficiaries.',
  },
  {
    id: 'ame-m2',
    title: 'Aircraft Maintenance Engineer (M2)',
    team: 'Maintenance',
    base: 'Iqaluit',
    type: 'Full time',
    salary: '$92,000 – $118,000',
    closes: 'Open until filled',
    summary:
      'Line maintenance on the turboprop fleet, working outside at temperatures that make every job '
      + 'take twice as long. The work that decides whether the community gets its aircraft tomorrow.',
    requirements: [
      'Transport Canada AME licence, M2 rating',
      'Dash 8 or ATR experience an asset',
      'Willingness to work outdoors in extreme cold',
    ],
    offered: [
      'Northern living allowance and subsidised housing',
      'Tool allowance and annual training budget',
      'Two weeks on, two weeks off available for southern-based candidates',
    ],
    priority: 'Preference given to Nunavut Agreement beneficiaries.',
  },
  {
    id: 'ame-apprentice',
    title: 'AME Apprentice',
    team: 'Maintenance',
    base: 'Iqaluit or Rankin Inlet',
    type: 'Apprenticeship — 4 years',
    salary: '$52,000 rising to $84,000',
    closes: 'Applications reviewed monthly',
    summary:
      'A four-year paid apprenticeship to a full AME licence, for Nunavummiut who want the trade and '
      + 'have no way into it. No prior aviation experience required.',
    requirements: [
      'Nunavut secondary school graduation or equivalent',
      'Residence in Nunavut',
      'Mechanical aptitude — demonstrated any way you like',
    ],
    offered: [
      'Paid throughout, with fees and books covered',
      'Block training in the south, with travel and accommodation paid',
      'A licensed trade at the end of it, and a job',
    ],
    priority: 'Open to Nunavut Agreement beneficiaries only.',
  },
  {
    id: 'customer-agent',
    title: 'Customer Service Agent',
    team: 'Airports',
    base: 'Any community on the network',
    type: 'Full time and part time',
    salary: '$48,000 – $62,000',
    closes: 'Open until filled',
    summary:
      'Check-in, bag drop, boarding and load control at your own community’s airport. The person '
      + 'who tells people the truth about the weather.',
    requirements: [
      'Fluent Inuktitut strongly preferred',
      'Comfortable with a computer and with a scale',
      'Able to lift 23 kg repeatedly',
    ],
    offered: [
      'Training provided, no aviation experience needed',
      'Staff travel on the network',
      'Part-time hours built around the schedule at smaller communities',
    ],
    priority: 'Preference given to residents of the community served.',
  },
  {
    id: 'cargo-coordinator',
    title: 'Cargo Coordinator',
    team: 'Cargo',
    base: 'Iqaluit',
    type: 'Full time',
    salary: '$58,000 – $74,000',
    closes: 'Open until filled',
    summary:
      'Booking, rating and load-planning freight across the network — including the country food that '
      + 'moves between communities, which is the part of the job that matters most to people.',
    requirements: [
      'Dangerous goods certification, or willingness to obtain it',
      'Comfortable making load decisions under time pressure',
    ],
    offered: ['Northern living allowance', 'Dangerous goods and load control training'],
    priority: 'Preference given to Nunavut Agreement beneficiaries.',
  },
  {
    id: 'dispatcher',
    title: 'Flight Dispatcher',
    team: 'Operational Control',
    base: 'Iqaluit',
    type: 'Full time, shift work',
    salary: '$76,000 – $94,000',
    closes: 'Open until filled',
    summary:
      'Flight planning, weather, fuel and the decision to go or not go — shared jointly with the '
      + 'captain, which is what operational control means.',
    requirements: [
      'Transport Canada Flight Dispatcher certificate',
      'Experience in northern or remote operations an asset',
    ],
    offered: ['Northern living allowance and subsidised housing', 'Shift premium and rotation'],
    priority: 'Preference given to Nunavut Agreement beneficiaries.',
  },
];

export const roleById = (id) => roles.find((r) => r.id === id) ?? null;
export const teams = [...new Set(roles.map((r) => r.team))];
