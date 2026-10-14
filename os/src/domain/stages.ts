import { all, get, run, tx } from '../db/database.ts';
import { nowIso } from '../lib/time.ts';
import type { Actor } from '../http/context.ts';
import { ValidationError } from './fields.ts';
import { getOrganization } from './organization.ts';
import { insertRow, logActivity, updateRow, setArchived } from './records.ts';

export interface Stage {
  id: string;
  name: string;
  description: string | null;
  position: number;
  archived_at: string | null;
  venture_count?: number;
}

export function listStages(includeArchived = false): Stage[] {
  return all<Stage>(
    `SELECT s.*, (SELECT count(*) FROM ventures v WHERE v.stage_id = s.id AND v.archived_at IS NULL) AS venture_count
       FROM development_stages s
      ${includeArchived ? '' : 'WHERE s.archived_at IS NULL'}
      ORDER BY s.archived_at IS NOT NULL, s.position`,
  );
}

export const getStage = (id: string): Stage | undefined => get<Stage>('SELECT * FROM development_stages WHERE id = ?', [id]);

function checkName(name: string, exceptId?: string): string {
  const n = name.trim();
  if (!n) throw new ValidationError({ name: 'Stage name is required.' });
  if (n.length > 60) throw new ValidationError({ name: 'Stage name must be 60 characters or fewer.' });
  if (get('SELECT 1 FROM development_stages WHERE name = ? COLLATE NOCASE AND id <> ?', [n, exceptId ?? ''])) {
    throw new ValidationError({ name: 'A stage with that name already exists.' });
  }
  return n;
}

export function createStage(name: string, description: string, actor: Actor): string {
  const org = getOrganization();
  const n = checkName(name);
  const max = get<{ p: number | null }>('SELECT max(position) AS p FROM development_stages')!.p ?? 0;
  const id = insertRow('stage', { organization_id: org.id, name: n, description: description.trim() || null, position: max + 1 });
  logActivity({ actor, type: 'stage.created', entityType: 'stage', entityId: id, summary: `Development stage “${n}” added` });
  return id;
}

export function updateStage(id: string, name: string, description: string, actor: Actor): void {
  const n = checkName(name, id);
  const changes = updateRow('stage', id, { name: n, description: description.trim() || null });
  if (Object.keys(changes).length) {
    logActivity({ actor, type: 'stage.updated', entityType: 'stage', entityId: id, summary: `Development stage “${n}” updated`, changes });
  }
}

export function moveStage(id: string, direction: 'up' | 'down'): void {
  tx(() => {
    const stages = listStages(false);
    const i = stages.findIndex((s) => s.id === id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= stages.length) return;
    const a = stages[i]!;
    const b = stages[j]!;
    const now = nowIso();
    run('UPDATE development_stages SET position = ?, updated_at = ? WHERE id = ?', [b.position, now, a.id]);
    run('UPDATE development_stages SET position = ?, updated_at = ? WHERE id = ?', [a.position, now, b.id]);
  });
}

export function archiveStage(id: string, actor: Actor): void {
  const inUse = get<{ n: number }>('SELECT count(*) AS n FROM ventures WHERE stage_id = ? AND archived_at IS NULL', [id])!.n;
  if (inUse) throw new ValidationError({ stage: `This stage is used by ${inUse} active venture${inUse === 1 ? '' : 's'}. Move them first.` });
  const active = get<{ n: number }>('SELECT count(*) AS n FROM development_stages WHERE archived_at IS NULL')!.n;
  if (active <= 1) throw new ValidationError({ stage: 'At least one stage must remain.' });
  const stage = getStage(id);
  if (stage && setArchived('stage', id, true)) {
    logActivity({ actor, type: 'stage.archived', entityType: 'stage', entityId: id, summary: `Development stage “${stage.name}” archived` });
  }
}

export function restoreStage(id: string, actor: Actor): void {
  const stage = getStage(id);
  if (!stage) return;
  const max = get<{ p: number | null }>('SELECT max(position) AS p FROM development_stages WHERE archived_at IS NULL')!.p ?? 0;
  if (setArchived('stage', id, false)) {
    run('UPDATE development_stages SET position = ? WHERE id = ?', [max + 1, id]);
    logActivity({ actor, type: 'stage.restored', entityType: 'stage', entityId: id, summary: `Development stage “${stage.name}” restored` });
  }
}
