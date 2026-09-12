/**
 * Brand configuration.
 *
 * Every user-visible name the airline owns is here, so renaming a fare family
 * or a service line is one edit rather than a search across the views.
 *
 * North Winds runs three service lines. They are presented as separate sections
 * of the app because they fly different aircraft into different kinds of
 * airport, but a single booking may span all three: the pricing and itinerary
 * engines do not care which line a segment belongs to.
 */

export const airline = {
  name: 'North Winds Airlines',
  shortName: 'North Winds',
  code: 'NW',
  callsign: 'NORTHWIND',
  base: 'Iqaluit, Nunavut',
  parent: 'North West Passage Holdings Corporation',
  currency: 'CAD',
  supportPhone: '1-800-555-0142',
  supportEmail: 'reservations@northwinds.example',
};

/**
 * The three service lines.
 *
 * `weight` orders them from the largest aircraft down; the results list uses it
 * to break ties so a jet is never buried under a milk run of the same price.
 */
export const brands = {
  altitude: {
    id: 'altitude',
    name: 'North Winds Altitude',
    shortName: 'Altitude',
    tagline: 'The jet fleet',
    description:
      'Jet service between Nunavut and the south, and across the territory on the '
      + 'sectors long enough to justify one. Altitude carries passengers and freight '
      + 'in the same airframe: most of the fleet is convertible, so the cabin shrinks '
      + 'when the community needs the hold.',
    accent: '#2E6E8E',
    weight: 3,
    fleet: ['b737-800', 'b737-700c'],
  },
  express: {
    id: 'express',
    name: 'North Winds Express',
    shortName: 'Express',
    tagline: 'Direct between hubs',
    description:
      'Scheduled turboprop service flown point to point — no intermediate stops. '
      + 'Express exists so that a trip between two larger communities does not have '
      + 'to ride the circuit around every strip in between.',
    accent: '#1F6B4E',
    weight: 2,
    fleet: ['atr42-500', 'dash8-300'],
  },
  connect: {
    id: 'connect',
    name: 'North Winds Connect',
    shortName: 'Connect',
    tagline: 'The milk runs',
    description:
      'The circuits. Connect flies the multi-stop runs that call at the small strips '
      + 'in sequence, carrying passengers, mail, freight and country food between '
      + 'communities that no road reaches. Two Baffin circuits alternate week by week; '
      + 'the shorter runs fly weekly.',
    accent: '#8A6D3B',
    weight: 1,
    fleet: ['dash8-100', 'kingair350'],
  },
};

export const brandList = Object.values(brands).sort((a, b) => b.weight - a.weight);

/**
 * Fare families, cheapest first.
 *
 * `multiplier` is applied to the computed base fare. Everything else is a rule
 * the change/cancel engine reads directly — there is no separate rules table to
 * fall out of step with this one.
 */
export const fareFamilies = [
  {
    id: 'tundra',
    name: 'Tundra',
    subtitle: 'Lowest fare, fixed',
    multiplier: 1,
    checkedBags: 1,
    seatSelection: 'paid',
    changeable: false,
    changeFee: null,
    refundable: false,
    creditOnCancel: false,
    sameDayStandby: false,
    priorityBoarding: false,
    lounge: false,
    milesRate: 0.25,
    includes: ['One checked bag (23 kg)', 'Carry-on', 'Seat assigned at check-in'],
    excludes: ['No changes', 'No refund or credit'],
  },
  {
    id: 'standard',
    name: 'Standard',
    subtitle: 'Change for a fee',
    multiplier: 1.32,
    checkedBags: 2,
    seatSelection: 'paid',
    changeable: true,
    changeFee: 75,
    refundable: false,
    creditOnCancel: true,
    cancelFee: 125,
    sameDayStandby: false,
    priorityBoarding: false,
    lounge: false,
    milesRate: 0.5,
    includes: ['Two checked bags (23 kg each)', 'Carry-on', 'Advance seat selection', 'Changes for $75 plus fare difference'],
    excludes: ['Cancellation held as travel credit, less $125'],
  },
  {
    id: 'flex',
    name: 'Flex',
    subtitle: 'Change free, credit on cancel',
    multiplier: 1.74,
    checkedBags: 2,
    seatSelection: 'free',
    changeable: true,
    changeFee: 0,
    refundable: false,
    creditOnCancel: true,
    cancelFee: 0,
    sameDayStandby: true,
    priorityBoarding: true,
    lounge: false,
    milesRate: 1,
    includes: [
      'Two checked bags (23 kg each)',
      'Free advance seat selection',
      'Free changes, fare difference only',
      'Full travel credit if you cancel',
      'Same-day standby on an earlier flight',
      'Priority boarding',
    ],
    excludes: [],
  },
  {
    id: 'summit',
    name: 'Summit',
    subtitle: 'Fully refundable',
    multiplier: 2.45,
    checkedBags: 3,
    seatSelection: 'free',
    changeable: true,
    changeFee: 0,
    refundable: true,
    creditOnCancel: true,
    cancelFee: 0,
    sameDayStandby: true,
    priorityBoarding: true,
    lounge: true,
    cabin: 'Summit cabin on Altitude jets',
    milesRate: 1.5,
    includes: [
      'Three checked bags (32 kg each)',
      'Summit cabin on Altitude jets, forward seating elsewhere',
      'Free changes and full refund to the original payment',
      'Same-day standby',
      'Priority boarding, baggage and check-in',
      'Lounge access at Iqaluit and Rankin Inlet',
    ],
    excludes: [],
  },
];

export const fareFamilyById = Object.fromEntries(fareFamilies.map((f) => [f.id, f]));

/**
 * Fare types — who is travelling, rather than what the ticket allows.
 *
 * These are the categories a northern carrier actually sells against. Each is
 * eligibility-gated: the app states the requirement and asks the traveller to
 * confirm it, exactly as a real booking engine does, because the discount is
 * verified at the counter and not by the app.
 */
export const fareTypes = [
  {
    id: 'standard',
    name: 'Standard fare',
    discount: 0,
    note: 'Open to everyone. No eligibility to confirm.',
  },
  {
    id: 'beneficiary',
    name: 'Nunavut Agreement beneficiary',
    discount: 0.3,
    note: 'For beneficiaries enrolled under the Nunavut Agreement. Enrolment card shown at check-in.',
    requiresId: 'Enrolment number',
  },
  {
    id: 'resident',
    name: 'Nunavut resident',
    discount: 0.18,
    note: 'For residents of a Nunavut community. Proof of residency shown at check-in.',
  },
  {
    id: 'elder',
    name: 'Elder (60+)',
    discount: 0.35,
    note: 'For travellers aged 60 and over. Photo identification shown at check-in.',
  },
  {
    id: 'youth',
    name: 'Youth and student',
    discount: 0.22,
    note: 'For travellers aged 12–24, or full-time students of any age with a valid student card.',
  },
  {
    id: 'medical',
    name: 'Medical travel',
    discount: 0.5,
    note: 'Booked against an approved medical travel authorisation. The authorisation number is required.',
    requiresId: 'Authorisation number',
    billed: true,
  },
  {
    id: 'duty',
    name: 'Government and duty travel',
    discount: 0.1,
    note: 'For travel on an approved government or organisational account.',
    requiresId: 'Account code',
    billed: true,
  },
  {
    id: 'compassionate',
    name: 'Compassionate travel',
    discount: 0.4,
    note: 'For travel following a death or serious illness in the family. Confirmed by our reservations team after booking.',
  },
];

export const fareTypeById = Object.fromEntries(fareTypes.map((t) => [t.id, t]));

/** Passenger categories. Infants travel on a lap and pay a percentage of fare. */
export const passengerTypes = [
  { id: 'adult', name: 'Adult', detail: '12 and over', fareShare: 1, min: 1, max: 9 },
  { id: 'child', name: 'Child', detail: '2 to 11', fareShare: 0.75, min: 0, max: 8 },
  { id: 'infant', name: 'Infant', detail: 'Under 2, on a lap', fareShare: 0.1, min: 0, max: 4 },
];

/**
 * Ancillaries.
 *
 * Country food and hunting equipment are here because they are what people
 * actually put on these aircraft. A baggage screen that offers only "extra
 * suitcase" is a southern airline's screen.
 */
export const ancillaries = [
  {
    id: 'bag-extra',
    name: 'Additional checked bag',
    unit: 'bag',
    price: 65,
    max: 4,
    detail: 'Up to 23 kg each, beyond the allowance included in your fare.',
    group: 'Baggage',
  },
  {
    id: 'bag-heavy',
    name: 'Overweight bag (23–32 kg)',
    unit: 'bag',
    price: 90,
    max: 4,
    detail: 'Per bag over 23 kg. Nothing over 32 kg is accepted as checked baggage.',
    group: 'Baggage',
  },
  {
    id: 'bag-oversize',
    name: 'Oversize item',
    unit: 'item',
    price: 110,
    max: 3,
    detail: 'Skis, komatik parts, outboard motors, building materials and similar.',
    group: 'Baggage',
  },
  {
    id: 'country-food',
    name: 'Country food shipment',
    unit: 'cooler',
    price: 45,
    max: 6,
    detail:
      'Sealed cooler carried in the hold, kept frozen where the routing allows. '
      + 'Booked with a passenger, or as freight if you are not travelling.',
    group: 'Freight',
  },
  {
    id: 'hunting-gear',
    name: 'Hunting and camp equipment',
    unit: 'item',
    price: 95,
    max: 4,
    detail: 'Firearms declared and cased, ammunition packed separately, per Transport Canada rules.',
    group: 'Freight',
  },
  {
    id: 'qimmiq',
    name: 'Dog in the hold',
    unit: 'animal',
    price: 130,
    max: 3,
    detail: 'In an approved kennel, in the heated hold. Space is limited on the Dash 8 and the King Air.',
    group: 'Freight',
  },
  {
    id: 'pet-cabin',
    name: 'Small pet in the cabin',
    unit: 'animal',
    price: 60,
    max: 2,
    detail: 'Under the seat in front of you, in a soft carrier. One per passenger.',
    group: 'Freight',
  },
  {
    id: 'priority',
    name: 'Priority check-in and boarding',
    unit: 'passenger',
    price: 30,
    max: 9,
    detail: 'Included with Flex and Summit fares.',
    group: 'Comfort',
  },
  {
    id: 'lounge',
    name: 'Lounge access at Iqaluit',
    unit: 'passenger',
    price: 55,
    max: 9,
    detail: 'Included with Summit fares. Available on Altitude departures only.',
    group: 'Comfort',
  },
];

export const ancillaryById = Object.fromEntries(ancillaries.map((a) => [a.id, a]));

/**
 * Government and airport charges, applied per passenger.
 *
 * These are modelled on the real structure of a Canadian domestic ticket — an
 * air travellers security charge, a NAV CANADA surcharge and an airport
 * improvement fee — so the price breakdown adds up the way a real one does.
 */
export const charges = {
  atsc: 9.94,            // Air Travellers Security Charge, per enplanement
  navCanada: 14.5,       // NAV CANADA service surcharge, per segment
  gstRate: 0.05,         // GST. Nunavut has no territorial sales tax.
  fuelSurchargeRate: 0.06,
};

/** The loyalty programme. Miles accrue by fare family; tiers are annual. */
export const loyalty = {
  name: 'North Winds Circle',
  tiers: [
    { id: 'blue', name: 'Circle', threshold: 0, benefits: ['Earn miles on every fare', 'Member-only seat sales'] },
    { id: 'silver', name: 'Circle Silver', threshold: 12000, benefits: ['One free bag beyond your fare', 'Free advance seat selection', 'Priority standby'] },
    { id: 'gold', name: 'Circle Gold', threshold: 30000, benefits: ['Two free bags beyond your fare', 'Priority boarding and baggage', 'Lounge access at Iqaluit', 'Waived change fees'] },
    { id: 'aurora', name: 'Circle Aurora', threshold: 60000, benefits: ['All Gold benefits', 'Summit upgrades when available', 'Companion pass each year', 'Dedicated reservations line'] },
  ],
};
