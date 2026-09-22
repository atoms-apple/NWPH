/**
 * The site's architecture.
 *
 * The desktop menus, the phone's full-screen menu and the footer are three
 * presentations of this one structure. Adding a screen means adding it here and
 * registering its route — it then appears in all three, in the right section,
 * with the same wording.
 *
 * `note` is not decoration. Half of these words mean nothing to someone who has
 * not flown this network before — "Connect", "duty travel", "country food" —
 * so every link says what it is for.
 */

export const sections = [
  {
    id: 'book',
    label: 'Book',
    tab: { icon: 'search', label: 'Book', path: '/book' },
    groups: [
      {
        heading: 'Flights',
        links: [
          { path: '/book', label: 'Search flights', note: 'One way, return, or a trip with several stops' },
          { path: '/book/multi-city', label: 'Multi-city', note: 'Up to four flights on one booking' },
          { path: '/deals', label: 'Seat sales', note: 'Where fares are low this fortnight' },
          { path: '/book/calendar', label: 'Low-fare calendar', note: 'A month of fares on one route at a glance' },
        ],
      },
      {
        heading: 'Other ways to travel',
        links: [
          { path: '/cargo', label: 'Cargo and freight', note: 'Quote and ship by the kilo, including country food' },
          { path: '/charter', label: 'Charter an aircraft', note: 'Camp support, medical transfer, community travel' },
          { path: '/groups', label: 'Group travel', note: 'Ten or more people on one booking' },
          { path: '/medical-travel', label: 'Medical travel', note: 'Booking against an approved authorisation' },
          { path: '/corporate', label: 'Duty and corporate travel', note: 'Organisational accounts and billed travel' },
        ],
      },
    ],
  },
  {
    id: 'trips',
    label: 'My trips',
    tab: { icon: 'ticket', label: 'Trips', path: '/trips' },
    groups: [
      {
        heading: 'Your travel',
        links: [
          { path: '/trips', label: 'My trips', note: 'Everything booked on this device' },
          { path: '/checkin', label: 'Check in', note: 'Opens 24 hours before departure' },
          { path: '/flights', label: 'Flight status', note: 'Departure boards, delays and the reason for them' },
          { path: '/credits', label: 'Travel credits', note: 'What a cancellation left you' },
        ],
      },
      {
        heading: 'Change something',
        links: [
          { path: '/trips', label: 'Change a flight or date', note: 'The fee and difference are quoted first' },
          { path: '/assistance', label: 'Special assistance', note: 'Mobility, medical, and travelling with children' },
          { path: '/baggage', label: 'Baggage and allowances', note: 'What is included, and what extra costs' },
        ],
      },
    ],
  },
  {
    id: 'explore',
    label: 'Where we fly',
    tab: { icon: 'map', label: 'Explore', path: '/destinations' },
    groups: [
      {
        heading: 'The network',
        links: [
          { path: '/destinations', label: 'Destinations', note: 'All 30 communities and gateways' },
          { path: '/network', label: 'Route map', note: 'Drawn from the real coordinates' },
          { path: '/milk-runs', label: 'Milk runs', note: 'The circuits, and which week each one flies' },
          { path: '/timetable', label: 'Timetable', note: 'Every scheduled service, printable' },
        ],
      },
      {
        heading: 'How we fly',
        links: [
          { path: '/brand/altitude', label: 'Altitude — the jet fleet', note: 'South, and the long sectors' },
          { path: '/brand/express', label: 'Express — direct services', note: 'Point to point between the hubs' },
          { path: '/brand/connect', label: 'Connect — the circuits', note: 'Every community, in sequence' },
          { path: '/fleet', label: 'Our fleet', note: 'Seven types, and which strips each can use' },
        ],
      },
    ],
  },
  {
    id: 'info',
    label: 'Travel info',
    groups: [
      {
        heading: 'Before you fly',
        links: [
          { path: '/baggage', label: 'Baggage', note: 'Allowances, excess, and a calculator' },
          { path: '/documents', label: 'Identification', note: 'What every traveller must carry' },
          { path: '/assistance', label: 'Special assistance', note: 'Tell us before you travel' },
          { path: '/advisories', label: 'Travel advisories', note: 'Weather and disruption, updated live' },
        ],
      },
      {
        heading: 'Getting help',
        links: [
          { path: '/help', label: 'Help centre', note: 'Answers to what people actually ask' },
          { path: '/contact', label: 'Contact us', note: 'Reservations, cargo, baggage and complaints' },
          { path: '/accessibility', label: 'Accessibility', note: 'How we build, and what is outstanding' },
          { path: '/legal', label: 'Conditions of carriage', note: 'The contract a ticket makes' },
        ],
      },
    ],
  },
  {
    id: 'circle',
    label: 'Circle',
    groups: [
      {
        heading: 'North Winds Circle',
        links: [
          { path: '/circle', label: 'The programme', note: 'How miles are earned and what they buy' },
          { path: '/circle/tiers', label: 'Tiers and benefits', note: 'Circle, Silver, Gold and Aurora' },
          { path: '/account/miles', label: 'My miles', note: 'Balance, activity and what is next' },
          { path: '/book/redeem', label: 'Book with miles', note: 'Any seat, any day, no blackout' },
        ],
      },
      {
        heading: 'Your account',
        links: [
          { path: '/account', label: 'Account overview', note: 'Everything stored on this device' },
          { path: '/account/travellers', label: 'Saved travellers', note: 'Family and colleagues you book for' },
          { path: '/account/payment', label: 'Payment methods', note: 'Cards kept for faster checkout' },
          { path: '/account/notifications', label: 'Notifications', note: 'What we message you about' },
        ],
      },
    ],
  },
  {
    id: 'company',
    label: 'About',
    groups: [
      {
        heading: 'North Winds',
        links: [
          { path: '/story', label: 'Our story', note: 'Why an Inuit-owned airline, and why now' },
          { path: '/community', label: 'In the community', note: 'Compassionate fares, sponsorship, hiring' },
          { path: '/careers', label: 'Careers', note: 'Flight crew, engineers, agents and apprentices' },
          { path: '/about', label: 'About this app', note: 'What is real here and what is invented' },
        ],
      },
      {
        heading: 'Services',
        links: [
          { path: '/cargo', label: 'Cargo services', note: 'Freight, mail and country food' },
          { path: '/charter', label: 'Charter services', note: 'On demand, across the territory' },
          { path: '/privacy', label: 'Privacy notice', note: 'What this app keeps, and where' },
        ],
      },
    ],
  },
];

/** The five destinations of the phone's bottom bar. */
export const tabs = [
  { id: 'home', path: '/', label: 'Home', icon: 'wind' },
  { id: 'book', path: '/book', label: 'Book', icon: 'search' },
  { id: 'trips', path: '/trips', label: 'Trips', icon: 'ticket' },
  { id: 'explore', path: '/destinations', label: 'Explore', icon: 'map' },
  { id: 'more', path: '/menu', label: 'Menu', icon: 'menu' },
];

/** The thin strip above the main bar on a wide screen. */
export const utilityLinks = [
  { path: '/flights', label: 'Flight status' },
  { path: '/advisories', label: 'Travel advisories' },
  { path: '/cargo', label: 'Cargo' },
  { path: '/charter', label: 'Charter' },
  { path: '/help', label: 'Help' },
  { path: '/contact', label: 'Contact' },
];

/** The footer's columns. A narrower selection than the menus — the things
 *  someone scrolls to the bottom looking for. */
export const footerColumns = [
  {
    heading: 'Book',
    links: [
      { path: '/book', label: 'Search flights' },
      { path: '/deals', label: 'Seat sales' },
      { path: '/book/multi-city', label: 'Multi-city' },
      { path: '/groups', label: 'Group travel' },
      { path: '/book/redeem', label: 'Book with miles' },
    ],
  },
  {
    heading: 'Travel',
    links: [
      { path: '/checkin', label: 'Check in' },
      { path: '/flights', label: 'Flight status' },
      { path: '/baggage', label: 'Baggage' },
      { path: '/assistance', label: 'Special assistance' },
      { path: '/documents', label: 'Identification' },
    ],
  },
  {
    heading: 'Network',
    links: [
      { path: '/destinations', label: 'Destinations' },
      { path: '/network', label: 'Route map' },
      { path: '/milk-runs', label: 'Milk runs' },
      { path: '/timetable', label: 'Timetable' },
      { path: '/fleet', label: 'Fleet' },
    ],
  },
  {
    heading: 'Services',
    links: [
      { path: '/cargo', label: 'Cargo and freight' },
      { path: '/charter', label: 'Charter' },
      { path: '/medical-travel', label: 'Medical travel' },
      { path: '/corporate', label: 'Duty travel' },
      { path: '/circle', label: 'North Winds Circle' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { path: '/story', label: 'Our story' },
      { path: '/community', label: 'In the community' },
      { path: '/careers', label: 'Careers' },
      { path: '/contact', label: 'Contact us' },
      { path: '/help', label: 'Help centre' },
    ],
  },
];

export const footerLegal = [
  { path: '/legal', label: 'Conditions of carriage' },
  { path: '/privacy', label: 'Privacy' },
  { path: '/accessibility', label: 'Accessibility' },
  { path: '/about', label: 'About this app' },
];

/** Flatten every link, for the help centre's search and the checks. */
export const allLinks = () => {
  const out = [];
  for (const section of sections) {
    for (const group of section.groups) {
      for (const link of group.links) out.push({ ...link, section: section.label, group: group.heading });
    }
  }
  return out;
};
