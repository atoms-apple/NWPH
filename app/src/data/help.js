/**
 * The help centre.
 *
 * Questions written the way people actually ask them, not the way a policy
 * document would phrase them, and grouped by what someone is trying to do. The
 * search on the help screen matches against question, answer and keywords, so a
 * question can be found by a word that does not appear in its title.
 */

export const categories = [
  { id: 'booking', name: 'Booking and fares', icon: 'search' },
  { id: 'changes', name: 'Changes and cancellations', icon: 'swap' },
  { id: 'airport', name: 'At the airport', icon: 'check' },
  { id: 'baggage', name: 'Baggage and freight', icon: 'bag' },
  { id: 'disruption', name: 'Delays and cancellations', icon: 'warning' },
  { id: 'circle', name: 'North Winds Circle', icon: 'star' },
  { id: 'network', name: 'How the network works', icon: 'map' },
];

export const questions = [
  /* ── Booking ──────────────────────────────────────────────────────────── */
  {
    id: 'why-expensive',
    category: 'booking',
    q: 'Why does it cost so much to fly between two communities?',
    keywords: ['price', 'expensive', 'cost', 'fare', 'cheap'],
    a: [
      'Because the aircraft is small, the sector is short, and the fixed costs of operating into a '
      + 'gravel strip in the Arctic are the same whether there are nine people aboard or thirty-seven.',
      'A jet to Ottawa carries 160 people over 2,100 km and costs about 15 cents per passenger '
      + 'kilometre to operate. A Dash 8 carrying twenty people 400 km into Pond Inlet costs three '
      + 'times that. The fare follows the cost, not the distance.',
      'Where you qualify for a beneficiary, resident, elder, student or medical fare, use it — the '
      + 'discount is applied to the base fare before charges and is often the difference between '
      + 'travelling and not.',
    ],
  },
  {
    id: 'discount-fares',
    category: 'booking',
    q: 'Which discounted fare am I eligible for?',
    keywords: ['beneficiary', 'elder', 'resident', 'student', 'youth', 'discount', 'medical'],
    a: [
      'Choose the fare type on the search screen and the discount is applied throughout. Eligibility '
      + 'is confirmed at check-in, not by the app.',
      'Nunavut Agreement beneficiaries take 30% off the base fare; elders aged 60 and over, 35%; '
      + 'Nunavut residents, 18%; youth and students, 22%; approved medical travel, 50%.',
      'A traveller who cannot show their entitlement at the counter pays the difference to the '
      + 'standard fare before boarding, so book the fare you can actually evidence.',
    ],
  },
  {
    id: 'fare-families',
    category: 'booking',
    q: 'What is the difference between Tundra, Standard, Flex and Summit?',
    keywords: ['fare family', 'tundra', 'standard', 'flex', 'summit', 'refundable'],
    a: [
      'Tundra is the lowest fare and is sold fixed: one bag, no changes, no refund and no credit. If '
      + 'your plans might move, it is the wrong fare however attractive the price.',
      'Standard adds a second bag and allows changes for $75 plus any fare difference; cancelling '
      + 'leaves you a travel credit less $125.',
      'Flex changes free, gives a full credit if you cancel, includes seat selection and priority '
      + 'boarding, and allows same-day standby on an earlier flight.',
      'Summit is fully refundable to the original payment, seats you in the Summit cabin on the '
      + 'jets, and carries three bags at 32 kg.',
    ],
  },
  {
    id: 'book-for-someone',
    category: 'booking',
    q: 'Can I book for someone else?',
    keywords: ['someone else', 'family', 'behalf', 'saved traveller'],
    a: [
      'Yes. Enter their name as it appears on the identification they will present, and put your own '
      + 'email and phone in the contact section so disruption messages reach you.',
      'Travellers you book for often can be saved to this device from the account screen, and '
      + 'offered on the next booking.',
    ],
  },
  {
    id: 'infant',
    category: 'booking',
    q: 'How do infants travel?',
    keywords: ['infant', 'baby', 'lap', 'child', 'car seat'],
    a: [
      'An infant under two travels on an adult’s lap at 10% of the fare, pays no security charge '
      + 'and no airport improvement fee, and has no seat and no boarding pass of their own.',
      'There cannot be more infants than adults on a booking. An infant who would be over two on the '
      + 'return leg must be booked as a child for that leg.',
      'An approved child restraint may be used if you buy a seat for it. Tell us at booking so we '
      + 'can seat you away from an exit row.',
    ],
  },
  {
    id: 'multi-city',
    category: 'booking',
    q: 'Can I visit several communities on one trip?',
    keywords: ['multi city', 'multi-city', 'several', 'stopover', 'open jaw'],
    a: [
      'Yes — use Multi-city and add up to four flights. It is the normal way to travel here: the '
      + 'circuits mean a trip to three communities is often one aircraft on one day.',
      'A multi-city booking is one ticket under one fare family, so the change and cancel rules apply '
      + 'to the whole thing.',
    ],
  },

  /* ── Changes ──────────────────────────────────────────────────────────── */
  {
    id: 'change-flight',
    category: 'changes',
    q: 'How do I change my flight?',
    keywords: ['change', 'move', 'different date', 'reschedule'],
    a: [
      'Open the booking under My trips and choose Change flight. Pick a new date and you are shown '
      + 'every option with the total you would pay — the fare difference plus the change fee for your '
      + 'fare family — before anything is committed.',
      'Seats already chosen are released when a flight changes, because the aircraft is usually a '
      + 'different one. You can choose new seats straight afterwards.',
      'Tundra fares cannot be changed at all.',
    ],
  },
  {
    id: 'cheaper-flight',
    category: 'changes',
    q: 'If I move to a cheaper flight, do I get the difference back?',
    keywords: ['cheaper', 'refund difference', 'downgrade'],
    a: [
      'Only on a Summit fare, which is fully refundable. On every other fare the difference is '
      + 'forfeited — you pay the change fee, if any, and keep the cheaper flight.',
      'The change screen states this plainly before you confirm.',
    ],
  },
  {
    id: 'standby',
    category: 'changes',
    q: 'Can I take an earlier flight on the day?',
    keywords: ['standby', 'earlier', 'same day', 'space available'],
    a: [
      'Flex and Summit fares include same-day standby on an earlier service between the same two '
      + 'communities. Ask at the counter or use Same-day standby in your booking.',
      'Standby is space-available, and on this network space runs out for weight reasons as often as '
      + 'for seat reasons. Keep your original booking until you are actually aboard.',
    ],
  },
  {
    id: 'cancel-refund',
    category: 'changes',
    q: 'What do I get back if I cancel?',
    keywords: ['cancel', 'refund', 'credit', 'money back'],
    a: [
      'It depends on the fare. Summit refunds in full to the original payment. Flex gives a full '
      + 'travel credit valid twelve months. Standard gives a credit less $125. Tundra gives nothing.',
      'Government charges paid on a wholly unused ticket can be reclaimed on any fare, including '
      + 'Tundra — contact reservations.',
    ],
  },

  /* ── At the airport ───────────────────────────────────────────────────── */
  {
    id: 'checkin-time',
    category: 'airport',
    q: 'When should I get to the airport?',
    keywords: ['arrive', 'how early', 'check in time', 'cut off'],
    a: [
      'Check-in opens 24 hours before departure and closes 45 minutes before it. Bag drop closes at '
      + 'the same time at Iqaluit, Rankin Inlet and Cambridge Bay, and 30 minutes before at every '
      + 'other community.',
      'At the smaller communities the counter opens about an hour before the aircraft is due and '
      + 'closes when it is loaded. If the inbound is early, so is everything else.',
    ],
  },
  {
    id: 'id-needed',
    category: 'airport',
    q: 'Do I need identification to fly within Nunavut?',
    keywords: ['id', 'identification', 'passport', 'licence', 'health card'],
    a: [
      'Yes — government-issued photo identification on every flight, including between communities.',
      'A passport, a driver’s licence, a territorial identification card, a Nunavut health card '
      + 'with a photograph, or an enrolment or status card with a photograph all work.',
      'Travellers under 18 do not need photo identification, but bring something showing their name '
      + 'and date of birth.',
    ],
  },
  {
    id: 'boarding-pass-offline',
    category: 'airport',
    q: 'Will my boarding pass work without signal?',
    keywords: ['offline', 'no signal', 'data', 'satellite'],
    a: [
      'Yes. Once you have checked in, the boarding pass is drawn from data already on your device '
      + 'and needs no connection at all. The whole app works offline, including the timetable.',
      'It will also print, if you would rather carry paper.',
    ],
  },
  {
    id: 'seats-assigned',
    category: 'airport',
    q: 'Why was I moved out of the seat I chose?',
    keywords: ['seat changed', 'moved', 'reseated', 'weight and balance'],
    a: [
      'On the small aircraft the crew set the seating to keep the aircraft within its weight and '
      + 'balance limits. On a Twin Otter with nine passengers, where people sit genuinely matters.',
      'If you are moved, the fee you paid for the original seat is refunded.',
    ],
  },

  /* ── Baggage ──────────────────────────────────────────────────────────── */
  {
    id: 'country-food',
    category: 'baggage',
    q: 'Can I send country food?',
    keywords: ['country food', 'meat', 'fish', 'caribou', 'char', 'cooler', 'frozen'],
    a: [
      'Yes. It travels in a sealed, leak-proof cooler in the hold, at $45 a cooler, and can be booked '
      + 'with a passenger or shipped as freight if you are not travelling yourself.',
      'It is kept frozen where the routing allows, but a circuit sits on the ground at several stops '
      + 'and a cooler can thaw. It is carried at the shipper’s risk.',
    ],
  },
  {
    id: 'bag-allowance',
    category: 'baggage',
    q: 'How many bags are included?',
    keywords: ['bags', 'allowance', 'free', 'weight', 'kg'],
    a: [
      'One on Tundra, two on Standard and Flex, three on Summit — 23 kg each, or 32 kg on Summit. '
      + 'A carry-on and a personal item are included on every fare.',
      'The baggage page has a calculator that works out what a particular load will cost.',
    ],
  },
  {
    id: 'bag-not-arrive',
    category: 'baggage',
    q: 'My bag did not come with me. What happens?',
    keywords: ['delayed bag', 'lost', 'missing', 'offload'],
    a: [
      'On the smaller aircraft the weight limit is reached before the seats are full, and baggage is '
      + 'offloaded to the next service. You are told at the counter before you fly, not after you land.',
      'We deliver it to you in the community at no charge, usually on the next service — which on a '
      + 'fortnightly circuit may be two weeks. Ask the agent for the expected date before you leave '
      + 'the counter.',
    ],
  },
  {
    id: 'firearm',
    category: 'baggage',
    q: 'Can I take a rifle?',
    keywords: ['firearm', 'rifle', 'gun', 'ammunition', 'hunting'],
    a: [
      'Yes, as checked baggage: declared at the counter, unloaded, in a locked hard case, with '
      + 'ammunition packed separately in its original packaging to a maximum of 5 kg.',
      'Declare it at check-in. A firearm discovered at the aircraft holds up the whole flight.',
    ],
  },

  /* ── Disruption ───────────────────────────────────────────────────────── */
  {
    id: 'weather-cancelled',
    category: 'disruption',
    q: 'My flight was cancelled for weather. What am I owed?',
    keywords: ['cancelled', 'weather', 'compensation', 'hotel', 'stranded'],
    a: [
      'We will carry you on the next available service at no charge, or refund the unused portion of '
      + 'your fare in full — your choice.',
      'Weather is outside our control, so no compensation, accommodation or meals are payable. Where '
      + 'the cause was within our control — an aircraft we failed to maintain, a crew we failed to '
      + 'roster — we meet reasonable accommodation and meal costs while you are delayed away from home.',
      'Change fees are waived on any ticket held through a published disruption, whatever the fare.',
    ],
  },
  {
    id: 'how-long-delay',
    category: 'disruption',
    q: 'Why does a weather hold last so long?',
    keywords: ['hold', 'delay', 'fog', 'long', 'waiting'],
    a: [
      'Because the decision is made on the observed weather, not the forecast, and it is reassessed '
      + 'each time a new observation comes in.',
      'Several communities have no runway lighting, so between November and February they can only '
      + 'be served in daylight. A few hours of fog in the morning can end the flying day for that '
      + 'community.',
    ],
  },
  {
    id: 'missed-connection',
    category: 'disruption',
    q: 'I missed my connection south. What now?',
    keywords: ['missed', 'connection', 'rebooked', 'overnight'],
    a: [
      'Where both flights are on the same North Winds booking, we rebook you at no charge onto the '
      + 'next service with space, and you keep your fare.',
      'Where you booked the onward flight separately, with us or with another carrier, that ticket is '
      + 'a separate contract and we cannot change it. This is the strongest reason to book the whole '
      + 'journey as one itinerary — the app builds circuit-to-jet connections as a single booking for '
      + 'exactly this reason.',
    ],
  },

  /* ── Circle ───────────────────────────────────────────────────────────── */
  {
    id: 'earn-miles',
    category: 'circle',
    q: 'How do I earn miles?',
    keywords: ['miles', 'points', 'earn', 'loyalty', 'circle'],
    a: [
      'Every fare earns, by distance flown and fare family: Tundra a quarter of a mile per kilometre, '
      + 'Standard a half, Flex one, Summit one and a half.',
      'Miles are credited after travel and never expire while the account has activity in a '
      + 'twenty-four month period.',
    ],
  },
  {
    id: 'spend-miles',
    category: 'circle',
    q: 'What can I spend miles on?',
    keywords: ['redeem', 'spend', 'reward', 'free flight'],
    a: [
      'Any seat on any service on any day — there are no blackout dates and no separate reward '
      + 'inventory. If we will sell you the seat, we will redeem it.',
      'Redemption is priced from the cash fare at 100 miles per dollar of base fare. Government and '
      + 'airport charges are paid in cash, because we have to remit them in cash.',
    ],
  },
  {
    id: 'tiers',
    category: 'circle',
    q: 'How do tiers work?',
    keywords: ['tier', 'silver', 'gold', 'aurora', 'status'],
    a: [
      'Tier is earned on miles flown in a calendar year: 12,000 for Silver, 30,000 for Gold, 60,000 '
      + 'for Aurora, and it holds for the following year.',
      'Silver adds a free bag and free seat selection; Gold adds a second bag, priority boarding, '
      + 'lounge access at Iqaluit and waived change fees; Aurora adds upgrades where space allows, a '
      + 'companion pass each year and a dedicated reservations line.',
    ],
  },

  /* ── Network ──────────────────────────────────────────────────────────── */
  {
    id: 'what-is-milk-run',
    category: 'network',
    q: 'What is a milk run?',
    keywords: ['milk run', 'circuit', 'stops', 'connect'],
    a: [
      'A scheduled service that calls at several communities in sequence, carrying passengers, mail, '
      + 'freight and country food between them. On this network they are flown by North Winds Connect.',
      'Every pair of stops on a circuit is sellable. You can board at Igloolik and get off at Pond '
      + 'Inlet without going back to Iqaluit, and the fare is for the pair you are flying, not the '
      + 'whole run.',
      'The two Baffin circuits alternate — North Baffin on even weeks, East Baffin on odd — so every '
      + 'community on the island sees an aircraft each fortnight.',
    ],
  },
  {
    id: 'three-brands',
    category: 'network',
    q: 'What are Altitude, Express and Connect?',
    keywords: ['altitude', 'express', 'connect', 'brands', 'service lines'],
    a: [
      'The three ways North Winds flies. Altitude is the jet fleet — south, and the long sectors '
      + 'across the territory. Express is direct turboprop service between the larger communities, '
      + 'with no intermediate stops. Connect is the circuits.',
      'They are sections of this app, not walls between them. One booking can use all three: Clyde '
      + 'River to Ottawa is a Connect circuit down to Iqaluit and an Altitude jet south, sold as one '
      + 'fare with the bags checked through.',
    ],
  },
  {
    id: 'no-flight-today',
    category: 'network',
    q: 'Why is there no flight on the day I want?',
    keywords: ['no service', 'not available', 'which days', 'frequency'],
    a: [
      'Most communities on this network see two or three services a week, and the fortnightly '
      + 'circuits see one every other week. That is the normal frequency, not a gap in the schedule.',
      'When a search finds nothing, the app tells you the next date that does work and offers to show '
      + 'it. The destination page for each community lists every service that calls there and the days '
      + 'it runs.',
    ],
  },
  {
    id: 'why-timezone',
    category: 'network',
    q: 'Why do the times look wrong on my connection?',
    keywords: ['time zone', 'timezone', 'local time', 'clock', 'salliq'],
    a: [
      'Every time in this app is the local clock at the airport it happens at, because that is the '
      + 'clock you will be reading when you are there. The network spans three time zones.',
      'Salliq is the one to watch: Southampton Island stays on Eastern Standard Time all year, so for '
      + 'half the year it is an hour ahead of the rest of the Kivalliq region.',
    ],
  },
];

/** Search over question, answer text and keywords. */
export function searchHelp(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return questions
    .map((question) => {
      const haystack = [
        question.q.toLowerCase(),
        question.a.join(' ').toLowerCase(),
        (question.keywords ?? []).join(' ').toLowerCase(),
      ];
      let score = 0;
      for (const term of terms) {
        if (haystack[0].includes(term)) score += 4;
        if (haystack[2].includes(term)) score += 3;
        if (haystack[1].includes(term)) score += 1;
      }
      return { question, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.question);
}

export const byCategory = (id) => questions.filter((q) => q.category === id);
