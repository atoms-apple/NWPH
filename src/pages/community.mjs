import { html } from '../lib/html.mjs';
import { Breadcrumbs, StatStrip, Facts, CTABlock, Accordion } from '../components/ui.mjs';
import { demo } from '../data/site.mjs';

/**
 * Community investment.
 *
 * The section a development corporation is most tempted to inflate. Written to
 * describe what the corporation does and what it declines to do, with the
 * declines given as much space as the commitments.
 */
export default function communityPage({ base }) {
  const f = demo.figures;

  return {
    path: '/community/',
    current: '/community/',
    title: 'Community',
    description:
      'Scholarships, training, sponsorship and community investment by North West Passage Holdings Corporation across the Qikiqtani region.',
    body: html`
      <section class="section section--dark">
        <div class="wrap">
          ${Breadcrumbs([{ href: `${base}/`, label: 'Home' }, { label: 'Community' }])}
          <p class="section__label">Community</p>
          <h1>What ownership is for</h1>
          <p class="section__intro">
            The point of owning these companies is that the benefit stays. Wages, training,
            procurement and surplus are the four ways that happens, and they are listed in
            that order deliberately.
          </p>
          ${StatStrip([
            { label: 'Employees', value: String(f.employees), flag: true },
            { label: 'Inuit employment', value: f.inuitEmployment },
            { label: 'Scholarships awarded', value: String(f.scholarships) },
            { label: 'Spend with Nunavut suppliers', value: f.procurementLocal },
          ], { label: 'Community investment at a glance' })}
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">First</p>
          <h2>Wages, before anything else</h2>
          <div class="split split--wide" style="margin-top: var(--space-l)">
            <div class="prose">
              <p>
                The largest transfer any of these companies makes to a community is its payroll.
                ${f.employees} people are employed across the portfolio, ${f.inuitEmployment} of
                them Nunavut Inuit, in ${f.communities} communities.
              </p>
              <p>
                That figure is reported every year in the annual report, at the portfolio level and
                by company, including where it has gone backwards. Aviation and marine operations
                remain the two hardest places to move it, for reasons of certification rather than
                intent, and the corporation says so rather than reporting an average that hides it.
              </p>
              <p>
                A sponsorship budget is a poor substitute for a payroll. Where the two compete for
                the same money, the payroll wins.
              </p>
            </div>
            <div>
              ${Facts([
                ['Employees', String(f.employees)],
                ['Inuit employment', f.inuitEmployment],
                ['Communities with staff', String(f.communities)],
                ['Apprentices this year', String(f.apprentices)],
                ['Spend with Nunavut suppliers', f.procurementLocal],
              ], { label: 'Employment and spend' })}
            </div>
          </div>
        </div>
      </section>

      <section class="section section--tint">
        <div class="wrap">
          <p class="section__label">Training</p>
          <h2>Apprenticeships and certification</h2>
          <p class="section__intro">
            ${f.apprentices} apprentices are placed across the portfolio this year, in aircraft
            maintenance, marine operations, construction trades and retail management.
          </p>
          <div class="grid grid--3" style="margin-top: var(--space-xl)">
            ${CTABlock({
              title: 'Apprentices are employees',
              body: 'Placed on payroll from day one, not students on work experience. Schooling costs, travel and accommodation are covered in full.',
            })}
            ${CTABlock({
              title: 'Certification is funded',
              body: 'Wilderness first aid, marine emergency duties, firearms safety, trades tickets and AME schooling are paid for by the company, not the employee.',
            })}
            ${CTABlock({
              title: 'Pathways, not placements',
              body: 'Assistant to guide to lead guide; deckhand to superintendent. Each operating company publishes the steps and what each one requires.',
            })}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <p class="section__label">Scholarships</p>
          <h2>Scholarship programme</h2>
          <div class="split split--wide" style="margin-top: var(--space-l)">
            <div class="prose">
              <p>
                ${f.scholarships} scholarships are awarded each year to Nunavut Inuit students in
                post-secondary study or trades training. There is no requirement to work for NWPH
                afterwards, and no expectation of it.
              </p>
              <p>
                Applications open each spring and are assessed by a committee that includes people
                from outside the corporation.
              </p>
            </div>
            <div>
              ${Facts([
                ['Awards per year', String(f.scholarships)],
                ['Eligibility', 'Nunavut Inuit beneficiaries'],
                ['Fields', 'Any — trades and academic'],
                ['Return-of-service condition', 'None'],
                ['Applications open', 'March'],
              ], { label: 'Scholarship programme' })}
            </div>
          </div>
        </div>
      </section>

      <section class="section section--dark">
        <div class="wrap">
          <p class="section__label">Sponsorship</p>
          <h2>What we support, and what we decline</h2>
          <p class="section__intro">
            A sponsorship budget invites requests the corporation cannot fairly assess. The rules
            are published so that a refusal is not a judgement about the applicant.
          </p>
          <div style="margin-top: var(--space-l)">
            ${Accordion([
              {
                question: 'What is supported',
                body: `<p>Community feasts and gatherings, harvesting and on-the-land programmes,
                youth sport and recreation, search and rescue organisations, and elders'
                programmes. Requests are assessed twice a year.</p>`,
              },
              {
                question: 'What is declined',
                body: `<p>Political campaigns and candidates. Anything that would create an
                obligation in a procurement or hiring decision. Requests from organisations where a
                director or officer has an undisclosed interest.</p>
                <p>Also declined: requests the corporation cannot fund consistently. A programme
                supported once and then dropped is worse for an organisation than one never
                supported.</p>`,
              },
              {
                question: 'How conflicts are handled',
                body: `<p>In a territory this size, applicants will often be connected to someone
                at the corporation. Interests are declared on the record and the person withdraws
                from the decision. That is disclosure and recusal, not disqualification — nobody is
                penalised for being related to somebody.</p>`,
              },
              {
                question: 'What is not claimed',
                body: `<p>The corporation does not describe its sponsorship as economic
                development. It is sponsorship. The economic development is the payroll, the
                training and the supplier spend, all of which are larger and reported
                separately.</p>`,
              },
            ])}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          ${CTABlock({
            title: 'Applying',
            body: 'Sponsorship requests and scholarship applications go through the contact form. Requests are assessed twice a year, in April and October.',
            actions: [
              { href: `${base}/contact/`, label: 'Contact NWPH', primary: true },
              { href: `${base}/reports/`, label: 'Annual reports' },
            ],
          })}
        </div>
      </section>`,
  };
}
