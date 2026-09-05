import { html, raw } from '../lib/html.mjs';
import { site, formEndpoint } from '../data/site.mjs';

/**
 * A labelled control with hint and error region wired up by id.
 *
 * Every field gets: a real <label for>, an aria-describedby chain covering both
 * the hint and the (initially empty) error node, and native constraint
 * attributes so validation works before enhance.js loads.
 */
export const Field = ({
  id, name, label, type = 'text', required = false, hint, autocomplete,
  minlength, maxlength, rows, options, placeholder, inputmode, pattern, patternMessage,
}) => {
  const describedBy = [hint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(' ');
  const common = raw([
    `id="${id}"`,
    `name="${name}"`,
    `aria-describedby="${describedBy}"`,
    `data-label="${label}"`,
    required ? 'required' : '',
    autocomplete ? `autocomplete="${autocomplete}"` : '',
    minlength ? `minlength="${minlength}"` : '',
    maxlength ? `maxlength="${maxlength}"` : '',
    placeholder ? `placeholder="${placeholder}"` : '',
    inputmode ? `inputmode="${inputmode}"` : '',
    pattern ? `pattern="${pattern}"` : '',
    patternMessage ? `data-pattern-message="${patternMessage}"` : '',
  ].filter(Boolean).join(' '));

  let control;
  if (type === 'textarea') {
    control = html`<textarea ${common} rows="${rows || 6}"></textarea>`;
  } else if (type === 'select') {
    control = html`<select ${common}>
      <option value="">Choose one…</option>
      ${options.map((option) => html`<option value="${option}">${option}</option>`)}
    </select>`;
  } else {
    control = html`<input type="${type}" ${common} />`;
  }

  return html`
    <p class="field">
      <label class="field__label" for="${id}">${label}${required
        ? html` <span class="req" aria-hidden="true">*</span><span class="visually-hidden"> (required)</span>`
        : html` <span class="field__optional">(optional)</span>`}</label>
      ${hint ? html`<span class="field__hint" id="${id}-hint">${hint}</span>` : ''}
      ${control}
      <span class="field__error" id="${id}-error" role="alert"></span>
    </p>`;
};

/**
 * Form shell.
 *
 * When no endpoint is configured the form is not rendered at all — showing a
 * form that silently discards a supplier's details would be worse than showing
 * none. The direct email address is offered instead.
 */
export const Form = ({ id, kind, title, description, fields, submitLabel }) => {
  if (!formEndpoint) {
    return html`
      <div class="callout" id="${id}">
        <p><strong>${title} is not yet accepting online submissions.</strong></p>
        <p>Email <a href="mailto:${site.email}?subject=${encodeURIComponent(title)}">${site.email}</a>
        with the subject “${title}” and we will reply with what we need.</p>
      </div>`;
  }

  return html`
    <form class="form" id="${id}" method="post" action="${formEndpoint}" data-validate novalidate>
      <div class="form__status" data-form-status role="status" aria-live="polite"></div>
      ${description ? html`<p class="field__hint">${description}</p>` : ''}

      <input type="hidden" name="form" value="${kind}" />
      <input type="hidden" name="_redirect" value="${site.origin}${site.base}/thank-you/" />
      <input type="hidden" name="elapsed" value="0" />

      <div class="hp" aria-hidden="true">
        <label for="${id}-company-url">Do not fill this in</label>
        <input type="text" id="${id}-company-url" name="company_url" tabindex="-1" autocomplete="off" />
      </div>

      <div class="form__grid">${fields}</div>

      <p class="form__required-note"><span class="req" aria-hidden="true">*</span> Required field.</p>
      <p class="form__actions">
        <button class="btn btn--primary" type="submit">${submitLabel}</button>
      </p>
    </form>`;
};

const nameFields = (prefix) => html`
  <div class="form__row">
    ${Field({ id: `${prefix}-name`, name: 'name', label: 'Your name', required: true, autocomplete: 'name', maxlength: 100 })}
    ${Field({ id: `${prefix}-email`, name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email', maxlength: 200 })}
  </div>`;

export const SupplierForm = () => Form({
  id: 'supplier-form',
  kind: 'supplier',
  title: 'Supplier registration',
  description: 'Registering does not create a contract or a commitment to purchase. It records your details so you can be contacted when a relevant requirement is issued.',
  submitLabel: 'Register as a supplier',
  fields: html`
    ${Field({ id: 'supplier-org', name: 'organisation', label: 'Business or organisation', required: true, autocomplete: 'organization', maxlength: 120 })}
    ${nameFields('supplier')}
    <div class="form__row">
      ${Field({ id: 'supplier-phone', name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', maxlength: 40 })}
      ${Field({ id: 'supplier-community', name: 'community', label: 'Community', hint: 'Where the business operates from.', maxlength: 80 })}
    </div>
    ${Field({
      id: 'supplier-status', name: 'inuit_firm', label: 'Inuit firm registry status', type: 'select',
      hint: 'As listed on the Nunavut Tunngavik Inuit Firm Registry, if applicable.',
      options: ['Registered Inuit firm', 'Application in progress', 'Not registered', 'Not sure'],
    })}
    ${Field({
      id: 'supplier-goods', name: 'goods_services', label: 'Goods or services offered', type: 'textarea',
      required: true, minlength: 20, maxlength: 2000, rows: 5,
      hint: 'What you supply, and which communities you can serve.',
    })}`,
});

export const PartnershipForm = () => Form({
  id: 'partnership-form',
  kind: 'partnership',
  title: 'Partnership enquiry',
  submitLabel: 'Send enquiry',
  fields: html`
    ${Field({ id: 'partner-org', name: 'organisation', label: 'Organisation', required: true, autocomplete: 'organization', maxlength: 120 })}
    ${nameFields('partner')}
    ${Field({
      id: 'partner-interest', name: 'interest', label: 'Area of interest', type: 'select', required: true,
      options: ['Joint venture', 'Investment or financing', 'Government or Inuit organisation programme', 'Supply agreement', 'Something else'],
    })}
    ${Field({
      id: 'partner-detail', name: 'message', label: 'What are you proposing?', type: 'textarea',
      required: true, minlength: 20, maxlength: 3000, rows: 7,
    })}`,
});

export const InterestForm = () => Form({
  id: 'interest-form',
  kind: 'career-interest',
  title: 'Expression of interest',
  description: 'For candidates whose skills do not match a currently posted role. Registers your interest across all seven operating companies.',
  submitLabel: 'Register my interest',
  fields: html`
    ${nameFields('interest')}
    <div class="form__row">
      ${Field({ id: 'interest-community', name: 'community', label: 'Community', maxlength: 80 })}
      ${Field({
        id: 'interest-beneficiary', name: 'beneficiary', label: 'Nunavut Inuit beneficiary', type: 'select',
        hint: 'Collected because hiring will apply Inuit employment preference.',
        options: ['Yes', 'No', 'Prefer not to say'],
      })}
    </div>
    ${Field({
      id: 'interest-area', name: 'area', label: 'Which sectors interest you?', type: 'textarea',
      required: true, minlength: 10, maxlength: 1500, rows: 4,
      hint: 'For example: guiding, aviation, marine freight, retail, technology.',
    })}
    ${Field({
      id: 'interest-experience', name: 'experience', label: 'Relevant experience or training', type: 'textarea',
      maxlength: 2000, rows: 5,
    })}`,
});

export const DocumentRequestForm = () => Form({
  id: 'documents-form',
  kind: 'document-request',
  title: 'Document request',
  description: 'For funders, procurement officers and prospective partners who need corporate documentation.',
  submitLabel: 'Request documents',
  fields: html`
    ${Field({ id: 'docs-org', name: 'organisation', label: 'Organisation', required: true, autocomplete: 'organization', maxlength: 120 })}
    ${nameFields('docs')}
    ${Field({
      id: 'docs-what', name: 'documents', label: 'What do you need?', type: 'textarea',
      required: true, minlength: 15, maxlength: 2000, rows: 5,
      hint: 'Audited statements, the annual report and corporate registration documents are available on request.',
    })}`,
});
