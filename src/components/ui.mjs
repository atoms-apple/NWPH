import { html, raw, attrs } from '../lib/html.mjs';
import { statusMeta, STATUS_VALUES, STATUS } from '../data/status.mjs';

/** Status is conveyed by word first; the dot is decorative reinforcement. */
export const StatusPill = (status) => {
  const meta = statusMeta(status);
  return html`<span class="status-pill status-pill--${meta.value}">
    <span class="status-pill__dot" aria-hidden="true"></span>${meta.label}</span>`;
};

/**
 * A venture card.
 *
 * Named ventures link to a detail page. Unnamed ones do not — there is nothing
 * to say about a company that does not exist yet beyond its sector and stage,
 * and a link implying otherwise would be the wrong promise.
 */
export const SubsidiaryCard = (subsidiary, { base = '' } = {}) => {
  const named = Boolean(subsidiary.name);
  return html`
    <li class="card ${named ? 'card--link' : 'card--unnamed'}" data-status="${subsidiary.status}">
      ${named ? html`<p class="card__sector">${subsidiary.sector}</p>` : ''}
      <h3 class="card__title">${named
        ? html`<a href="${base}/subsidiaries/${subsidiary.slug}/">${subsidiary.name}</a>`
        : subsidiary.sector}</h3>
      ${named
        ? html`<p class="card__legal">${subsidiary.legalName}</p>`
        : html`<p class="card__legal">Not yet named</p>`}
      <p class="card__body">${subsidiary.summary}</p>
      <p class="card__foot">
        ${StatusPill(subsidiary.status)}
        ${subsidiary.target ? html`<span class="card__target">${subsidiary.target}</span>` : ''}
      </p>
    </li>`;
};

/**
 * The path a named venture has to walk before it can trade. Rendered as an
 * ordered list because the order is the point — these are sequential, and the
 * target date depends on the slowest of them.
 */
export const MilestoneList = (milestones) => html`
  <ol class="milestones">
    ${milestones.map((milestone) => html`
      <li class="milestone">
        <h3 class="milestone__title">${milestone.title}</h3>
        <div class="milestone__body">${raw(milestone.body)}</div>
        ${milestone.state ? html`<p class="milestone__state">${milestone.state.replace('-', ' ')}</p>` : ''}
      </li>`)}
  </ol>`;

export const PersonCard = (person) => html`
  <li class="person">
    <h3 class="person__name">${person.name}</h3>
    <p class="person__role">${person.role}</p>
    <div class="person__bio">${raw(person.body)}</div>
  </li>`;

/**
 * Stat strip. Rendered as a description list so each figure is programmatically
 * bound to its label rather than merely sitting above it.
 */
export const StatStrip = (items, { light = false, label } = {}) => html`
  <dl class="stats ${light ? 'stats--light' : ''}"${label ? raw(` aria-label="${label}"`) : raw('')}>
    ${items.map((item) => html`
      <div class="stats__item ${item.flag ? 'stats__item--flag' : ''}">
        <dt class="stats__label">${item.label}</dt>
        <dd class="stats__value">${item.value}</dd>
      </div>`)}
  </dl>`;

export const CTABlock = ({ title, body, actions = [], id }) => html`
  <div class="cta"${id ? raw(` id="${id}"`) : raw('')}>
    <h2 class="cta__title">${title}</h2>
    ${body ? html`<p>${body}</p>` : ''}
    ${actions.length ? html`<p class="cta__actions">${actions.map((action) => html`
      <a class="btn ${action.primary ? 'btn--primary' : 'btn--ghost'}" href="${action.href}">${action.label}</a>`)}</p>` : ''}
  </div>`;

export const Callout = (body) => html`<div class="callout">${raw(body)}</div>`;

/** Accordion built on native <details> — keyboard-operable with no script. */
export const Accordion = (items, { name } = {}) => html`
  <div class="accordion">
    ${items.map((item) => html`
      <details class="accordion__item"${name ? raw(` name="${name}"`) : raw('')}>
        <summary class="accordion__summary">
          ${item.question || item.title}
          <span class="accordion__icon" aria-hidden="true"></span>
        </summary>
        <div class="accordion__body prose">${raw(item.body)}</div>
      </details>`)}
  </div>`;

/**
 * Tab group. Server output is a list of in-page links with every panel visible
 * and headed; enhance.js upgrades it to a real tablist. Without JS the content
 * is all still there and reachable.
 */
export const Tabs = (panels, { label, idPrefix = 'panel' }) => html`
  <div class="tabs" data-tabs data-tabs-label="${label}">
    <ul class="tabs__list">
      ${panels.map((panel) => html`
        <li><a class="tabs__tab" href="#${idPrefix}-${panel.id}">${panel.label}</a></li>`)}
    </ul>
    ${panels.map((panel) => html`
      <section class="tabs__panel" id="${idPrefix}-${panel.id}">
        <h3 class="tabs__panel-heading">${panel.label}</h3>
        ${raw(panel.body)}
      </section>`)}
  </div>`;

/**
 * Subsidiary browser: CSS-only filtering.
 *
 * Radio inputs plus :has() do the work, so filtering survives JavaScript being
 * off or blocked — and because "All" is the checked default, the no-JS and
 * no-:has() outcome is every card visible, never an empty page.
 */
export const SubsidiaryBrowser = (subsidiaries, { base = '' } = {}) => {
  const counts = Object.fromEntries(
    STATUS_VALUES.map((value) => [value, subsidiaries.filter((s) => s.status === value).length]),
  );
  const empties = STATUS_VALUES.filter((value) => counts[value] === 0);

  return html`
    <div class="subsidiary-browser" data-filter-scope>
      <fieldset class="filter">
        <legend class="filter__legend">Filter by stage</legend>
        <div class="filter__options">
          <span class="filter__option">
            <input type="radio" name="status-filter" id="filter-all" value="all" checked />
            <label for="filter-all">All stages (${subsidiaries.length})</label>
          </span>
          ${STATUS_VALUES.map((value) => html`
            <span class="filter__option">
              <input type="radio" name="status-filter" id="filter-${value}" value="${value}"${counts[value] === 0 ? raw(' disabled') : raw('')} />
              <label for="filter-${value}">${STATUS[value].label} (${counts[value]})</label>
            </span>`)}
        </div>
        <p class="filter__count" data-filter-count role="status"></p>
      </fieldset>

      <ul class="grid grid--3 subsidiary-grid" role="list">
        ${subsidiaries.map((subsidiary) => SubsidiaryCard(subsidiary, { base }))}
      </ul>

      ${empties.map((value) => html`
        <p class="filter-empty" data-for="${value}">No subsidiaries are at the ${STATUS[value].label.toLowerCase()} stage.</p>`)}
    </div>`;
};
