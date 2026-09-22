/**
 * Baggage, identification, assistance and the conditions of carriage.
 *
 * Written as structured content rather than pages of markup, so the same rule
 * can appear in the baggage calculator, in the fare rules and on the policy
 * page without being restated three times and drifting apart.
 */

import { fareFamilies } from './brand.js';

/* ── Baggage ─────────────────────────────────────────────────────────────── */

export const baggage = {
  carryOn: {
    items: [
      { name: 'Carry-on bag', limit: '23 × 40 × 55 cm, 10 kg', note: 'Overhead bin, or the hold on the Twin Otter and King Air where there is no bin.' },
      { name: 'Personal item', limit: '16 × 33 × 43 cm', note: 'Under the seat in front of you.' },
    ],
    note:
      'On the Twin Otter and the King Air there is no overhead bin and very little cabin room. '
      + 'Carry-on is taken at the aircraft and placed in the nose or rear compartment; take what you '
      + 'need for the flight out of it first.',
  },
  checked: {
    maxWeight: 32,
    freeWeight: 23,
    maxDimensions: '158 cm total (length + width + height)',
    rows: fareFamilies.map((family) => ({
      family: family.name,
      included: family.checkedBags,
      weight: family.checkedBags > 2 ? 32 : 23,
    })),
  },
  /** Charges beyond the fare's allowance. Mirrors the ancillary catalogue. */
  fees: [
    { name: 'Additional bag', price: 65, unit: 'per bag', note: 'Up to 23 kg' },
    { name: 'Overweight bag', price: 90, unit: 'per bag', note: '23–32 kg. Nothing over 32 kg is accepted.' },
    { name: 'Oversize item', price: 110, unit: 'per item', note: 'Over 158 cm total — skis, komatik parts, outboards, building materials' },
    { name: 'Country food cooler', price: 45, unit: 'per cooler', note: 'Sealed, kept frozen where the routing allows' },
    { name: 'Hunting and camp equipment', price: 95, unit: 'per item', note: 'Firearms declared and cased' },
    { name: 'Dog in the hold', price: 130, unit: 'per animal', note: 'Approved kennel, heated hold' },
    { name: 'Small pet in the cabin', price: 60, unit: 'per animal', note: 'Soft carrier, under the seat' },
  ],
  restricted: [
    {
      title: 'Firearms and ammunition',
      body:
        'Accepted as checked baggage, declared at check-in, unloaded and in a locked hard case. '
        + 'Ammunition travels separately in its original packaging, to a maximum of 5 kg per '
        + 'passenger. Tell the agent at the counter, not at the aircraft.',
    },
    {
      title: 'Fuel, stoves and lanterns',
      body:
        'Liquid fuel is not carried in any quantity. A camp stove is accepted only if it is empty, '
        + 'purged and free of fuel odour. Fuel bottles must be empty and open.',
    },
    {
      title: 'Batteries',
      body:
        'Spare lithium batteries travel in the cabin, terminals taped, never in the hold. Anything '
        + 'over 100 Wh needs approval before travel; over 160 Wh is not carried.',
    },
    {
      title: 'Harvested meat and fish',
      body:
        'Carried as country food in a sealed, leak-proof cooler. There is no limit on quantity '
        + 'beyond the aircraft’s load, but frozen goods may thaw on a circuit that sits on the '
        + 'ground at several stops, and are carried at the shipper’s risk.',
    },
    {
      title: 'Aerosols and compressed gas',
      body:
        'Personal toiletries in aerosols are permitted in limited quantity. Compressed gas '
        + 'cylinders, including propane, are not carried on passenger services. They move as '
        + 'declared dangerous goods on the cargo service.',
    },
  ],
  delayed:
    'Space on the smaller aircraft runs out before the seats do. Where the load requires it, '
    + 'baggage and freight travel on the next service. You are told at the counter before you fly, '
    + 'not after you have landed, and we deliver it to you in the community at no charge.',
};

/* ── Identification ──────────────────────────────────────────────────────── */

export const identification = {
  intro:
    'Every traveller aged 18 and over must show government-issued photo identification at '
    + 'check-in, on every flight, including between communities within Nunavut.',
  accepted: [
    'A valid passport',
    'A provincial or territorial driver’s licence',
    'A general identification card issued by a province or territory',
    'A Nunavut health card with photograph',
    'A Certificate of Indian Status or Inuit enrolment card with photograph',
    'A Canadian permanent resident card',
    'A NEXUS card',
  ],
  children:
    'Travellers under 18 do not need photo identification on domestic flights, but the adult they '
    + 'are travelling with should carry something showing the child’s name and date of birth — '
    + 'a birth certificate or health card is enough.',
  unaccompanied:
    'Children aged 5 to 11 travelling alone must be booked as unaccompanied minors. We take them '
    + 'from the person who brings them to the counter and hand them to the named person at the '
    + 'other end, who must show identification. The fee is $60 each way, and the service is not '
    + 'offered on an itinerary with an overnight connection.',
  noId:
    'A traveller who cannot produce identification may still be carried at the agent’s '
    + 'discretion, with an identity check by other means. This takes time. Arrive early.',
};

/* ── Special assistance ──────────────────────────────────────────────────── */

export const assistanceTypes = [
  {
    id: 'wheelchair-airport',
    name: 'Wheelchair to the aircraft',
    note: 'Assistance through the terminal and to the aircraft door. Requested free of charge.',
    lead: 48,
  },
  {
    id: 'wheelchair-own',
    name: 'Travelling with your own mobility aid',
    note:
      'Carried free and in addition to your baggage allowance. Tell us the type, dimensions and '
      + 'battery, if any — the Twin Otter and King Air have limited door and hold space.',
    lead: 48,
  },
  {
    id: 'boarding-assist',
    name: 'Help boarding and seating',
    note: 'Most of this network boards by airstair from the apron. Crew will help you up and to your seat.',
    lead: 24,
  },
  {
    id: 'service-dog',
    name: 'Service dog in the cabin',
    note: 'Carried free of charge, at your feet. We need the handler’s and the dog’s details before travel.',
    lead: 48,
  },
  {
    id: 'oxygen',
    name: 'Medical oxygen or a concentrator',
    note:
      'A portable oxygen concentrator may be used in the cabin with a physician’s letter. '
      + 'Compressed oxygen cylinders are not carried.',
    lead: 72,
  },
  {
    id: 'stretcher',
    name: 'Stretcher or medical escort',
    note: 'Arranged through our charter desk, usually on the King Air. Not available on scheduled services.',
    lead: 96,
  },
  {
    id: 'hearing-vision',
    name: 'Hearing or vision assistance',
    note: 'Safety briefings given individually, and an escort through the terminal where you want one.',
    lead: 24,
  },
  {
    id: 'unaccompanied-minor',
    name: 'Unaccompanied minor',
    note: 'Ages 5 to 11 travelling alone. $60 each way, not available on an overnight connection.',
    lead: 48,
  },
  {
    id: 'interpretation',
    name: 'Inuktitut-speaking agent',
    note: 'Available at every community counter and on the reservations line during opening hours.',
    lead: 0,
  },
];

/* ── Conditions of carriage ──────────────────────────────────────────────── */

export const carriage = [
  {
    id: 'contract',
    heading: 'What a ticket is',
    body: [
      'A ticket is a contract between the passenger named on it and North Winds Airlines. It is not '
      + 'transferable. The fare rules that applied when it was bought continue to apply for the life '
      + 'of the ticket, including after a change.',
      'Where these conditions and a fare rule disagree, the fare rule governs the fare and these '
      + 'conditions govern everything else.',
    ],
  },
  {
    id: 'schedule',
    heading: 'Schedules are not guaranteed',
    body: [
      'Times shown are the times we intend to operate. They are not part of the contract. Weather, '
      + 'runway condition, crew duty limits and the serviceability of an aircraft all take '
      + 'precedence over a published time, and on this network they frequently do.',
      'Where we cancel or substantially delay a flight, we will carry you on our next available '
      + 'service at no additional charge, or refund the unused portion of the fare in full — '
      + 'whichever you choose.',
    ],
  },
  {
    id: 'weather',
    heading: 'Weather and events beyond our control',
    body: [
      'Where a disruption is caused by weather, a runway closure, an air traffic control restriction '
      + 'or any other event outside our control, we will rebook or refund as above. We do not pay '
      + 'compensation, accommodation or meals in those circumstances.',
      'Where the disruption is within our control — an aircraft we failed to maintain, a crew we '
      + 'failed to roster — we will meet reasonable accommodation and meal costs for the period you '
      + 'are delayed away from home.',
    ],
  },
  {
    id: 'load',
    heading: 'Load and the right to offload',
    body: [
      'On the smaller aircraft, weight and balance limits are reached before the seats run out. '
      + 'Where a flight is over its limit we will offload freight before baggage, and baggage before '
      + 'passengers. Where a passenger must be offloaded we ask for volunteers first, and medical '
      + 'travel, compassionate travel and unaccompanied minors are carried before all other classes.',
    ],
  },
  {
    id: 'denied',
    heading: 'Refusal to carry',
    body: [
      'We may refuse to carry a passenger who is intoxicated, whose conduct endangers or seriously '
      + 'discomforts others, who will not comply with crew instructions, or who cannot be carried '
      + 'safely given the aircraft and the routing. Where we refuse carriage for these reasons the '
      + 'fare is not refunded.',
    ],
  },
  {
    id: 'baggage-liability',
    heading: 'Baggage liability',
    body: [
      'Our liability for checked baggage lost, damaged or delayed is limited to $2,300 per '
      + 'passenger unless a higher value is declared and the applicable charge paid at check-in.',
      'We do not accept liability for fragile or perishable items, cash, documents, medication or '
      + 'electronics carried in checked baggage. Country food is carried at the shipper’s risk.',
    ],
  },
  {
    id: 'claims',
    heading: 'Making a claim',
    body: [
      'A claim for damaged baggage must be made within seven days of receiving it, and for delayed '
      + 'baggage within twenty-one days of the day it was placed at your disposal. A claim for any '
      + 'other matter must be made within two years.',
      'Claims are made to our baggage desk at any community counter, or in writing to the address '
      + 'on the contact page.',
    ],
  },
];

/* ── Privacy ─────────────────────────────────────────────────────────────── */

export const privacy = [
  {
    id: 'what',
    heading: 'What this app stores',
    body: [
      'Everything this app keeps is stored in this browser, on this device: your bookings, your '
      + 'boarding passes, the travellers you have saved, and the details you typed to make a '
      + 'booking. None of it is transmitted anywhere, because there is no server to transmit it to.',
      'That also means none of it is backed up. Clearing your browser’s site data erases it, '
      + 'and it does not follow you to another device.',
    ],
  },
  {
    id: 'what-not',
    heading: 'What it does not do',
    body: [
      'There is no analytics, no tracking, no advertising identifier, no third-party script and no '
      + 'network request of any kind after the app has loaded. Payment card fields are not '
      + 'transmitted, stored or validated against anything — they exist so the flow is complete.',
    ],
  },
  {
    id: 'real',
    heading: 'What a real airline would do differently',
    body: [
      'A live North Winds would need to hold bookings on a server, share them with airport systems, '
      + 'and pass passenger details to the operators it interlines with. It would be subject to '
      + 'PIPEDA, and would publish a privacy policy describing retention, access and correction.',
      'This page describes what this prototype does, which is much less.',
    ],
  },
  {
    id: 'erase',
    heading: 'Erasing everything',
    body: [
      'The account screen has a control that erases every booking, boarding pass and saved detail '
      + 'from this device. It takes effect immediately and cannot be undone.',
    ],
  },
];
