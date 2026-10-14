import { html } from '../../lib/html.ts';
import { formatDateTime } from '../../lib/time.ts';
import { run, get } from '../../db/database.ts';
import { nowIso } from '../../lib/time.ts';
import { htmlReply, redirect, type Context } from '../../http/context.ts';
import type { Router } from '../../http/router.ts';
import { listStages, createStage, updateStage, moveStage, archiveStage, restoreStage } from '../../domain/stages.ts';
import { listUsers, createUser, activeOwnerCount } from '../../auth/users.ts';
import { ROLES, type Role } from '../../auth/permissions.ts';
import { hashPassword, verifyPassword, passwordProblem, MIN_PASSWORD_LENGTH } from '../../auth/password.ts';
import { destroyUserSessions } from '../../auth/sessions.ts';
import { addExamples, removeExamples, exampleCount } from '../../domain/examples.ts';
import { ValidationError } from '../../domain/fields.ts';
import { logActivity } from '../../domain/records.ts';
import { page } from '../layout.ts';
import { pageHeader, section, badge, postButton, notice } from '../ui.ts';
import { UUID_RE } from '../common.ts';

function settingsPage(ctx: Context): string {
  const stages = listStages(true);
  const active = stages.filter((s) => !s.archived_at);
  const users = ctx.can('admin') ? listUsers() : [];
  const examples = exampleCount();
  const body = html`${pageHeader({ title: 'Settings' })}

  ${section('Your account', html`<p>Signed in as <strong>${ctx.user!.display_name}</strong> (${ctx.user!.email}), role ${badge(ROLES.find((r) => r.value === ctx.user!.role)!.label)}.</p>
    <details class="disclosure"><summary>Change password</summary>
      <form method="post" action="/settings/password" class="form form--narrow">
        <input type="hidden" name="_csrf" value="${ctx.csrf}">
        <div class="field"><label for="current">Current password</label><input id="current" name="current" type="password" autocomplete="current-password" required></div>
        <div class="field"><label for="next">New password</label><input id="next" name="next" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" required><p class="field__help">At least ${MIN_PASSWORD_LENGTH} characters. Other sessions will be signed out.</p></div>
        <div class="form__actions"><button class="btn btn--secondary" type="submit">Change password</button></div>
      </form></details>`, { id: 'account' })}

  ${section('Development stages', html`
    <p class="panel__desc">The stages a venture moves through. Rename, reorder or add stages; archive a stage once no active venture uses it. Changing stages never changes a venture’s legal or operational status.</p>
    <div class="table-wrap"><table class="table table--stack">
      <thead><tr><th scope="col">Order</th><th scope="col">Stage</th><th scope="col">Ventures</th><th scope="col">Actions</th></tr></thead>
      <tbody>${stages.map((s) => {
        const i = active.findIndex((a) => a.id === s.id);
        return html`<tr class="${s.archived_at ? 'is-done' : ''}">
          <td data-label="Order">${s.archived_at ? badge('Archived', 'muted') : i + 1}</td>
          <th scope="row" data-label="Stage">${ctx.can('admin') && !s.archived_at
            ? html`<form method="post" action="/settings/stages/${s.id}" class="inline-edit"><input type="hidden" name="_csrf" value="${ctx.csrf}">
                <label class="visually-hidden" for="sn-${s.id}">Name</label><input id="sn-${s.id}" name="name" value="${s.name}" maxlength="60" required>
                <label class="visually-hidden" for="sd-${s.id}">Description</label><input id="sd-${s.id}" name="description" value="${s.description ?? ''}" maxlength="300" placeholder="Description">
                <button class="btn btn--small btn--ghost" type="submit">Save</button></form>`
            : html`${s.name}<span class="cell-meta">${s.description ?? ''}</span>`}</th>
          <td data-label="Ventures">${s.venture_count ?? 0}</td>
          <td data-label="Actions">${ctx.can('admin')
            ? s.archived_at
              ? postButton(ctx, `/settings/stages/${s.id}/restore`, 'Restore', { variant: 'link' })
              : html`${i > 0 ? postButton(ctx, `/settings/stages/${s.id}/move`, 'Move up', { variant: 'link', fields: { direction: 'up' } }) : ''}${i < active.length - 1 ? postButton(ctx, `/settings/stages/${s.id}/move`, 'Move down', { variant: 'link', fields: { direction: 'down' } }) : ''}${postButton(ctx, `/settings/stages/${s.id}/archive`, 'Archive', { variant: 'link', confirm: `Archive the stage “${s.name}”?` })}`
            : ''}</td>
        </tr>`;
      })}</tbody></table></div>
    ${ctx.can('admin') ? html`<form method="post" action="/settings/stages" class="form form--compact form--inline">
      <input type="hidden" name="_csrf" value="${ctx.csrf}">
      <div class="field"><label for="new-stage">New stage</label><input id="new-stage" name="name" maxlength="60" required></div>
      <div class="field"><label for="new-stage-d">Description</label><input id="new-stage-d" name="description" maxlength="300"></div>
      <div class="form__actions"><button class="btn btn--secondary" type="submit">Add stage</button></div></form>` : html`<p class="muted">Only owners can change stages.</p>`}`, { id: 'stages' })}

  ${ctx.can('admin') ? section('Users and roles', html`
    <ul class="role-list">${ROLES.map((r) => html`<li><strong>${r.label}</strong>: ${r.description}</li>`)}</ul>
    <div class="table-wrap"><table class="table table--stack">
      <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Last sign-in</th><th scope="col">Access</th></tr></thead>
      <tbody>${users.map((u) => html`<tr class="${u.is_active ? '' : 'is-done'}">
        <th scope="row" data-label="User">${u.display_name}<span class="cell-meta">${u.email}</span></th>
        <td data-label="Role">${u.id === ctx.user!.id ? badge(ROLES.find((r) => r.value === u.role)!.label) : html`<form method="post" action="/settings/users/${u.id}/role" class="status-form"><input type="hidden" name="_csrf" value="${ctx.csrf}">
          <label class="visually-hidden" for="role-${u.id}">Role for ${u.display_name}</label>
          <select id="role-${u.id}" name="role" data-autosubmit>${ROLES.map((r) => html`<option value="${r.value}"${r.value === u.role ? ' selected' : ''}>${r.label}</option>`)}</select>
          <button class="btn btn--small btn--ghost js-hide" type="submit">Set</button></form>`}</td>
        <td data-label="Last sign-in">${u.last_login_at ? formatDateTime(u.last_login_at) : html`<span class="muted">Never</span>`}</td>
        <td data-label="Access">${u.id === ctx.user!.id ? html`<span class="muted">You</span>` : postButton(ctx, `/settings/users/${u.id}/${u.is_active ? 'disable' : 'enable'}`, u.is_active ? 'Disable' : 'Enable', { variant: 'link', confirm: u.is_active ? `Disable ${u.display_name}? They will be signed out immediately.` : undefined })}</td>
      </tr>`)}</tbody></table></div>
    <details class="disclosure"><summary>Add a user</summary>
      <form method="post" action="/settings/users" class="form">
        <input type="hidden" name="_csrf" value="${ctx.csrf}">
        <div class="form__grid">
          <div class="field"><label for="u-name">Name</label><input id="u-name" name="display_name" required maxlength="120"></div>
          <div class="field"><label for="u-email">Email</label><input id="u-email" name="email" type="email" required></div>
          <div class="field"><label for="u-role">Role</label><select id="u-role" name="role">${ROLES.map((r) => html`<option value="${r.value}"${r.value === 'editor' ? ' selected' : ''}>${r.label}</option>`)}</select></div>
          <div class="field"><label for="u-pass">Initial password</label><input id="u-pass" name="password" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" required><p class="field__help">Share it securely; ask them to change it after signing in.</p></div>
        </div>
        <div class="form__actions"><button class="btn btn--secondary" type="submit">Create user</button></div>
      </form></details>
    <p class="footnote">There is no email delivery, so invitations and password resets are manual. An owner can reset a password with <code>npm run user:create</code> for a new account, or by disabling and recreating one.</p>`, { id: 'users' }) : ''}

  ${ctx.can('admin') ? section('Example data', html`
    <p class="panel__desc">Example records demonstrate how the modules connect. Each is titled “[Example]”, flagged as an example everywhere it appears, and attached to a separate example venture, never to Polar Express.</p>
    ${examples
      ? html`${notice('warn', `${examples} example records are present.`)}${postButton(ctx, '/settings/examples/remove', 'Permanently remove example records', { variant: 'danger', confirm: 'Permanently delete every record marked as an example? Real records are not affected.' })}`
      : postButton(ctx, '/settings/examples/add', 'Add example records')}`, { id: 'examples' }) : ''}

  ${section('About this installation', html`<dl class="deflist">
    <div class="deflist__row"><dt>Data storage</dt><dd>SQLite database on this server. Uploaded files are stored privately outside the web root.</dd></div>
    <div class="deflist__row"><dt>Document search</dt><dd>Metadata only; file contents are not indexed.</dd></div>
    <div class="deflist__row"><dt>Integrations</dt><dd>None. Opportunities, funding and documents are entered manually.</dd></div>
  </dl>`)}`;
  return page(ctx, { title: 'Settings', active: 'settings', body });
}

function guard(ctx: Context, fn: () => void, success: string): ReturnType<typeof redirect> {
  try {
    fn();
    ctx.flash('success', success);
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    ctx.flash('error', Object.values(err.errors)[0] ?? 'That change could not be made.');
  }
  return redirect('/settings#stages');
}

export function registerSettings(router: Router): void {
  router.get('/settings', 'read', (ctx) => htmlReply(settingsPage(ctx)));

  router.post('/settings/password', 'read', async (ctx) => {
    const row = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [ctx.user!.id])!;
    const next = ctx.form.get('next');
    if (!(await verifyPassword(ctx.form.get('current'), row.password_hash))) ctx.flash('error', 'Current password is incorrect.');
    else if (passwordProblem(next)) ctx.flash('error', passwordProblem(next)!);
    else {
      run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [await hashPassword(next), nowIso(), ctx.user!.id]);
      destroyUserSessions(ctx.user!.id, ctx.session!.tokenHash);
      logActivity({ actor: ctx.actor, type: 'user.password_changed', entityType: 'user', entityId: ctx.user!.id, summary: `${ctx.user!.display_name} changed their password` });
      ctx.flash('success', 'Password changed. Other sessions have been signed out.');
    }
    return redirect('/settings#account');
  });

  router.post('/settings/stages', 'admin', (ctx) => guard(ctx, () => createStage(ctx.form.get('name'), ctx.form.get('description'), ctx.actor), 'Stage added.'));
  router.post('/settings/stages/:id', 'admin', (ctx) => guard(ctx, () => updateStage(ctx.params.id!, ctx.form.get('name'), ctx.form.get('description'), ctx.actor), 'Stage saved.'));
  router.post('/settings/stages/:id/move', 'admin', (ctx) => guard(ctx, () => moveStage(ctx.params.id!, ctx.form.get('direction') === 'up' ? 'up' : 'down'), 'Stage order updated.'));
  router.post('/settings/stages/:id/archive', 'admin', (ctx) => guard(ctx, () => archiveStage(ctx.params.id!, ctx.actor), 'Stage archived.'));
  router.post('/settings/stages/:id/restore', 'admin', (ctx) => guard(ctx, () => restoreStage(ctx.params.id!, ctx.actor), 'Stage restored.'));

  router.post('/settings/users', 'admin', async (ctx) => {
    const role = ctx.form.get('role') as Role;
    try {
      if (!ROLES.some((r) => r.value === role)) throw new Error('Choose a valid role.');
      const u = await createUser({ email: ctx.form.get('email'), displayName: ctx.form.get('display_name'), password: ctx.form.get('password'), role });
      logActivity({ actor: ctx.actor, type: 'user.created', entityType: 'user', entityId: u.id, summary: `User ${u.display_name} added as ${role}` });
      ctx.flash('success', `${u.display_name} can now sign in.`);
    } catch (err) {
      ctx.flash('error', (err as Error).message);
    }
    return redirect('/settings#users');
  });
  router.post('/settings/users/:id/role', 'admin', (ctx) => {
    const id = ctx.params.id!;
    const role = ctx.form.get('role') as Role;
    const target = UUID_RE.test(id) ? get<{ role: Role; display_name: string }>('SELECT role, display_name FROM users WHERE id = ?', [id]) : undefined;
    if (!target || !ROLES.some((r) => r.value === role) || id === ctx.user!.id) ctx.flash('error', 'That role change is not allowed.');
    else if (target.role === 'owner' && role !== 'owner' && activeOwnerCount() <= 1) ctx.flash('error', 'At least one active owner is required.');
    else {
      run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, nowIso(), id]);
      logActivity({ actor: ctx.actor, type: 'user.role_changed', entityType: 'user', entityId: id, summary: `${target.display_name}: role ${target.role} → ${role}`, changes: { role: [target.role, role] } });
      ctx.flash('success', 'Role updated.');
    }
    return redirect('/settings#users');
  });
  for (const [action, active] of [['disable', 0], ['enable', 1]] as const) {
    router.post(`/settings/users/:id/${action}`, 'admin', (ctx) => {
      const id = ctx.params.id!;
      const target = UUID_RE.test(id) ? get<{ role: Role; display_name: string; is_active: number }>('SELECT role, display_name, is_active FROM users WHERE id = ?', [id]) : undefined;
      if (!target || id === ctx.user!.id) ctx.flash('error', 'You cannot change your own access.');
      else if (!active && target.role === 'owner' && activeOwnerCount() <= 1) ctx.flash('error', 'At least one active owner is required.');
      else {
        run('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?', [active, nowIso(), id]);
        if (!active) destroyUserSessions(id);
        logActivity({ actor: ctx.actor, type: `user.${action}d`, entityType: 'user', entityId: id, summary: `${target.display_name} ${action}d` });
        ctx.flash('success', `${target.display_name} ${action}d.`);
      }
      return redirect('/settings#users');
    });
  }

  router.post('/settings/examples/add', 'admin', (ctx) => {
    addExamples(ctx.actor);
    ctx.flash('success', 'Example records added. They are marked [Example] wherever they appear.');
    return redirect('/settings#examples');
  });
  router.post('/settings/examples/remove', 'admin', (ctx) => {
    const n = removeExamples(ctx.actor);
    ctx.flash('success', `${n} example records permanently removed.`);
    return redirect('/settings#examples');
  });
}
