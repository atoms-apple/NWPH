/**
 * Role-based permissions, checked on the server for every route.
 * The interface hides controls a role cannot use, but that is a convenience;
 * the route table is the enforcement point.
 */

export type Role = 'owner' | 'editor' | 'viewer';

export type Permission =
  | 'read' // view any record
  | 'write' // create and edit business records
  | 'archive' // archive and restore records
  | 'verify' // mark financial actuals and documents verified
  | 'admin'; // users, stages, example data, organization legal status

const GRANTS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(['read', 'write', 'archive', 'verify', 'admin']),
  editor: new Set(['read', 'write', 'archive']),
  viewer: new Set(['read']),
};

export const ROLES: ReadonlyArray<{ value: Role; label: string; description: string }> = [
  { value: 'owner', label: 'Owner', description: 'Everything, including users, stages, verification and example data.' },
  { value: 'editor', label: 'Editor', description: 'Create, edit and archive business records.' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to every record.' },
];

export const can = (role: Role | undefined, permission: Permission): boolean =>
  Boolean(role && GRANTS[role]?.has(permission));
