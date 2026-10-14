/**
 * Executive dashboard metrics. Every number is a COUNT or SUM over real
 * records; there are no stored or hand-entered dashboard figures. Records
 * belonging to archived ventures are excluded (see IN_ACTIVE_VENTURE).
 */
import { all, get } from '../db/database.ts';
import { today, addDays } from '../lib/time.ts';
import { listStages } from './stages.ts';
import { IN_ACTIVE_VENTURE } from './ventures.ts';
import { listTasks, listMilestones, type Task, type Milestone } from './work.ts';
import { listDecisions, type Decision } from './decisions.ts';
import { listRisks, type Risk } from './risks.ts';
import { listActivity, type ActivityRow } from './records.ts';
import { summarize, listEntries, type CurrencySummary } from './finance.ts';
import { getOrganization } from './organization.ts';

export interface Deadline {
  date: string;
  kind: 'task' | 'milestone' | 'opportunity' | 'decision review' | 'risk review';
  title: string;
  href: string;
  context: string | null;
}

export interface Dashboard {
  ventureTotal: number;
  byStage: { id: string; name: string; count: number }[];
  byOperational: Record<string, number>;
  activeProjects: number;
  openProjects: number;
  upcomingMilestones: Milestone[];
  overdueTasks: Task[];
  blockedTasks: Task[];
  openTaskCount: number;
  outstandingDecisions: Decision[];
  openRisks: number;
  highRisks: Risk[];
  deadlines: Deadline[];
  activity: ActivityRow[];
  finance: CurrencySummary[];
}

const count = (sql: string, params: Record<string, string> = {}): number => get<{ n: number }>(sql, params)!.n;

export function buildDashboard(): Dashboard {
  const t = today();
  const stages = listStages();
  const byStage = stages.map((s) => ({ id: s.id, name: s.name, count: s.venture_count ?? 0 }));
  const byOperational: Record<string, number> = {};
  for (const r of all<{ operational_status: string; n: number }>(
    'SELECT operational_status, count(*) AS n FROM ventures WHERE archived_at IS NULL GROUP BY operational_status',
  )) {
    byOperational[r.operational_status] = r.n;
  }

  const milestoneHorizon = addDays(t, 90);
  const upcomingMilestones = listMilestones({ open: true }).filter((m) => m.due_date && m.due_date <= milestoneHorizon);

  const deadlines: Deadline[] = [];
  const horizon = addDays(t, 30);
  for (const task of listTasks({ open: true })) {
    if (task.due_date && task.due_date >= t && task.due_date <= horizon) {
      deadlines.push({ date: task.due_date, kind: 'task', title: task.title, href: `/tasks/${task.id}/edit`, context: task.venture_name ?? 'NWPH' });
    }
  }
  for (const m of upcomingMilestones) {
    if (m.due_date! >= t && m.due_date! <= horizon) {
      deadlines.push({ date: m.due_date!, kind: 'milestone', title: m.title, href: `/milestones/${m.id}/edit`, context: m.venture_name ?? 'NWPH' });
    }
  }
  for (const o of all<{ id: string; title: string; deadline: string; venture_name: string | null }>(
    `SELECT o.id, o.title, o.deadline, v.name AS venture_name FROM opportunities o LEFT JOIN ventures v ON v.id = o.venture_id
      WHERE o.archived_at IS NULL AND ${IN_ACTIVE_VENTURE('o')} AND o.status NOT IN ('submitted','awarded','unsuccessful','expired','not_pursuing')
        AND o.deadline BETWEEN :t AND :h`,
    { t, h: addDays(t, 60) },
  )) {
    deadlines.push({ date: o.deadline, kind: 'opportunity', title: o.title, href: `/opportunities/${o.id}`, context: o.venture_name ?? 'NWPH' });
  }
  for (const d of all<{ id: string; title: string; review_date: string; venture_name: string | null }>(
    `SELECT d.id, d.title, d.review_date, v.name AS venture_name FROM decisions d LEFT JOIN ventures v ON v.id = d.venture_id
      WHERE d.archived_at IS NULL AND ${IN_ACTIVE_VENTURE('d')} AND d.status IN ('proposed','under_review','deferred')
        AND d.review_date BETWEEN :t AND :h`,
    { t, h: horizon },
  )) {
    deadlines.push({ date: d.review_date, kind: 'decision review', title: d.title, href: `/decisions/${d.id}`, context: d.venture_name ?? 'NWPH' });
  }
  for (const r of all<{ id: string; title: string; review_date: string; venture_name: string | null }>(
    `SELECT r.id, r.title, r.review_date, v.name AS venture_name FROM risks r LEFT JOIN ventures v ON v.id = r.venture_id
      WHERE r.archived_at IS NULL AND ${IN_ACTIVE_VENTURE('r')} AND r.status IN ('open','monitoring','occurred')
        AND r.review_date BETWEEN :t AND :h`,
    { t, h: horizon },
  )) {
    deadlines.push({ date: r.review_date, kind: 'risk review', title: r.title, href: `/risks/${r.id}/edit`, context: r.venture_name ?? 'NWPH' });
  }
  deadlines.sort((a, b) => a.date.localeCompare(b.date));

  return {
    ventureTotal: count('SELECT count(*) AS n FROM ventures WHERE archived_at IS NULL'),
    byStage,
    byOperational,
    activeProjects: count(`SELECT count(*) AS n FROM projects p WHERE p.archived_at IS NULL AND p.status = 'active' AND ${IN_ACTIVE_VENTURE('p')}`),
    openProjects: count(`SELECT count(*) AS n FROM projects p WHERE p.archived_at IS NULL AND p.status IN ('planned','active','on_hold') AND ${IN_ACTIVE_VENTURE('p')}`),
    upcomingMilestones,
    overdueTasks: listTasks({ overdue: true }),
    blockedTasks: listTasks({ blocked: true }),
    openTaskCount: count(`SELECT count(*) AS n FROM tasks t WHERE t.archived_at IS NULL AND t.status NOT IN ('completed','cancelled') AND ${IN_ACTIVE_VENTURE('t')}`),
    outstandingDecisions: listDecisions({ open: true }),
    openRisks: count(`SELECT count(*) AS n FROM risks r WHERE r.archived_at IS NULL AND r.status IN ('open','monitoring','occurred') AND ${IN_ACTIVE_VENTURE('r')}`),
    highRisks: listRisks({ active: true, high: true }),
    deadlines: deadlines.slice(0, 12),
    activity: listActivity({ limit: 10 }),
    finance: summarize(listEntries({ scenarioId: null })),
  };
}

// ── Onboarding ──────────────────────────────────────────────────────────────

export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

export function onboardingSteps(): OnboardingStep[] {
  const org = getOrganization();
  const has = (table: string) => count(`SELECT count(*) AS n FROM ${table} WHERE is_example = 0`) > 0;
  const pe = get<{ slug: string }>(`SELECT slug FROM ventures WHERE archived_at IS NULL ORDER BY created_at LIMIT 1`);
  const ws = pe ? `/ventures/${pe.slug}` : '/ventures';
  const ventureReviewed =
    count(`SELECT count(*) AS n FROM activity_events WHERE entity_type = 'venture' AND actor_id IS NOT NULL
             AND event_type IN ('venture.created','venture.updated','venture.status_changed','venture.stage_changed')`) > 0;
  return [
    { key: 'org', title: 'Review the organization profile', description: 'Confirm what is true about NWPH today. Legal status stays “Not verified” until you record otherwise.', href: '/organization', done: Boolean(org.profile_reviewed_at) },
    { key: 'venture', title: 'Review or edit the Polar Express profile', description: 'Replace provisional defaults with what has actually been decided, or create another venture.', href: `${ws}/plan`, done: ventureReviewed },
    { key: 'project', title: 'Add the first project', description: 'A body of work with a goal, such as a feasibility study.', href: `/projects/new${pe ? '' : ''}`, done: has('projects') },
    { key: 'milestone', title: 'Define the first milestone', description: 'A checkpoint that marks real progress.', href: `${ws}/milestones`, done: has('milestones') },
    { key: 'finance', title: 'Record initial financial assumptions', description: 'Startup costs, funding requirements, potential funding sources. Each is labelled forecast, budget or actual.', href: `${ws}/finance`, done: has('financial_entries') },
    { key: 'document', title: 'Add a research document', description: 'Market research, government publications or meeting notes, with their sources.', href: `${ws}/research`, done: has('documents') },
    { key: 'decision', title: 'Create a decision record', description: 'Record a proposal, the options considered and, once decided, the outcome.', href: `${ws}/decisions`, done: has('decisions') },
  ];
}
