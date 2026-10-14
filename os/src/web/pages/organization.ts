import { html } from '../../lib/html.ts';
import { formatDateTime } from '../../lib/time.ts';
import { htmlReply, redirect, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import {
  getOrganization,
  updateOrganization,
  markProfileReviewed,
  ORGANIZATION_FIELDS,
  ORGANIZATION_LEGAL_FIELDS,
} from '../../domain/organization.ts';
import { LEGAL_STATUSES } from '../../domain/vocabulary.ts';
import { listActivity } from '../../domain/records.ts';
import type { Errors } from '../../domain/fields.ts';
import { page } from '../layout.ts';
import { pageHeader, section, definitionList, statusBadge, linkButton, postButton, notice } from '../ui.ts';
import { renderForm, toFormValues, type FormValues } from '../forms.ts';
import { submit } from '../common.ts';
import { activityList } from './activity.ts';
import { paragraphs } from '../../lib/html.ts';
import { listVentures } from '../../domain/ventures.ts';

function editPage(ctx: Context, legal: boolean, values: FormValues, errors: Errors = {}): string {
  const fields = legal ? ORGANIZATION_LEGAL_FIELDS : ORGANIZATION_FIELDS;
  return page(ctx, {
    title: legal ? 'Edit legal status' : 'Edit organization profile',
    active: 'organization',
    body: html`${pageHeader({ title: legal ? 'Legal and corporate status' : 'Edit organization profile', eyebrow: 'Organization' })}
      ${legal ? notice('warn', 'Record only facts that have been confirmed, ideally with a reference to the registration document. This affects how NWPH is represented across the platform.') : ''}
      ${section('Details', renderForm(ctx, { action: legal ? '/organization/legal' : '/organization', fields, values, errors, submitLabel: 'Save', cancelHref: '/organization' }))}`,
  });
}

export function registerOrganization(router: Router): void {
  router.get('/organization', 'read', (ctx) => {
    const org = getOrganization();
    const ventures = listVentures();
    const body = html`${pageHeader({
      eyebrow: 'Organization profile',
      title: org.name,
      meta: html`${statusBadge(LEGAL_STATUSES, org.legal_status)}`,
      actions: html`${ctx.can('write') ? linkButton('/organization/edit', 'Edit profile', 'primary') : ''}${ctx.can('admin') ? linkButton('/organization/legal', 'Edit legal status') : ''}`,
    })}
    ${!org.profile_reviewed_at && ctx.can('write')
      ? notice('info', html`<p>Review this profile and confirm it reflects NWPH as it is today. The defaults were written to avoid claiming anything that has not been verified.</p><p>${postButton(ctx, '/organization/reviewed', 'Mark profile as reviewed', { variant: 'primary' })}</p>`, 'Profile not yet reviewed')
      : org.profile_reviewed_at
        ? html`<p class="footnote">Profile last reviewed ${formatDateTime(org.profile_reviewed_at)}.</p>`
        : ''}
    <div class="grid grid--2">
      ${section('Profile', definitionList([
        { label: 'Headquarters', value: org.headquarters },
        { label: 'Description', value: paragraphs(org.description) },
        { label: 'Mission', value: paragraphs(org.mission) },
        { label: 'Guiding philosophy', value: paragraphs(org.guiding_philosophy) },
        { label: 'Ownership and control', value: paragraphs(org.ownership_notes) },
        { label: 'Internal notes', value: paragraphs(org.notes) },
      ]))}
      ${section('Legal and corporate status', html`${definitionList([
        { label: 'Legal status', value: statusBadge(LEGAL_STATUSES, org.legal_status) },
        { label: 'Legal name', value: org.legal_name },
        { label: 'Detail / evidence', value: paragraphs(org.legal_status_detail) },
        { label: 'Jurisdiction', value: org.jurisdiction },
        { label: 'Registration reference', value: org.registration_reference },
      ])}<p class="footnote">Recorded by users of NWPH OS. NWPH OS does not verify registrations with any registry. Only owners can change these fields.</p>`)}
    </div>
    ${section('Relationship to ventures', ventures.length
      ? html`<table class="table"><thead><tr><th scope="col">Venture</th><th scope="col">Relationship to ${org.name}</th><th scope="col">Legal status</th></tr></thead><tbody>
        ${ventures.map((v) => html`<tr><th scope="row"><a href="/ventures/${v.slug}">${v.name}</a></th><td>${v.parent_relationship ?? html`<span class="muted">Not recorded</span>`}</td><td>${statusBadge(LEGAL_STATUSES, v.legal_status)}</td></tr>`)}
      </tbody></table>`
      : html`<p class="muted">No active ventures.</p>`)}
    ${section('Recent changes', activityList(listActivity({ entityType: 'organization', limit: 10 })))}`;
    return htmlReply(page(ctx, { title: 'Organization Profile', active: 'organization', body }));
  });

  router.get('/organization/edit', 'write', (ctx) => htmlReply(editPage(ctx, false, toFormValues(ORGANIZATION_FIELDS, getOrganization() as unknown as Record<string, unknown>))));
  router.post('/organization', 'write', (ctx) =>
    submit(ctx, ORGANIZATION_FIELDS, (values) => {
      updateOrganization(values, ctx.actor);
      ctx.flash('success', 'Organization profile saved.');
      return redirect('/organization');
    }, (v, e) => editPage(ctx, false, v, e)),
  );
  router.get('/organization/legal', 'admin', (ctx) => htmlReply(editPage(ctx, true, toFormValues(ORGANIZATION_LEGAL_FIELDS, getOrganization() as unknown as Record<string, unknown>))));
  router.post('/organization/legal', 'admin', (ctx) =>
    submit(ctx, ORGANIZATION_LEGAL_FIELDS, (values) => {
      updateOrganization(values, ctx.actor);
      ctx.flash('success', 'Legal status saved.');
      return redirect('/organization');
    }, (v, e) => editPage(ctx, true, v, e)),
  );
  router.post('/organization/reviewed', 'write', (ctx) => {
    markProfileReviewed(ctx.actor);
    ctx.flash('success', 'Organization profile marked as reviewed.');
    return redirect('/organization');
  });
}
