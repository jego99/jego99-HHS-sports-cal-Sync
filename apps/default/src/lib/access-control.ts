import type { GenesisNode } from '@/lib/genesis-data';
import { getFieldValue } from '@/lib/genesis-data';

export const ACCESS_PROJECT_ID = 'fj5G2QAAWzQyK7wm';
export const DIRECTORY_PROJECT_ID = 'V9NRsAo6RidHoU2X';
export const ADMIN_EMAIL = 'jay.ego@hermistonsd.org';

export type AccessRecord = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  allowedCategories: string;
  access: string;
};

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase();
}

export function readAccessRecord(row: GenesisNode): AccessRecord {
  return {
    id: row.id,
    email: getFieldValue(row, 'Email') ?? '',
    displayName: getFieldValue(row, 'Display Name') ?? '',
    role: getFieldValue(row, 'Role') ?? 'Editor',
    allowedCategories: getFieldValue(row, 'Allowed Categories') ?? '',
    access: getFieldValue(row, 'Access') ?? 'Invited',
  };
}

export function findAccessRecord(rows: GenesisNode[], email: string | null | undefined) {
  const target = normalizeEmail(email);
  if (target.length === 0) return null;
  const matches = rows.map(readAccessRecord).filter((record) => normalizeEmail(record.email) === target);
  return matches.find((record) => record.role.trim().toLowerCase() !== 'administrator') ?? matches[0] ?? null;
}

export function isAdministrator(email: string | null | undefined) {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

export function hasPortalAccess(record: AccessRecord | null) {
  return record != null && ['Invited', 'Active', 'invited', 'active'].includes(record.access);
}

export function getAllowedActivities(record: AccessRecord | null) {
  if (record == null || record.allowedCategories.trim().toLowerCase() === 'all categories') return [];
  return record.allowedCategories
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function canEditActivity(email: string | null | undefined, record: AccessRecord | null, activityName: string) {
  if (record == null || !hasPortalAccess(record)) return false;
  if (isAdministrator(email)) return true;
  if (record.allowedCategories.trim().toLowerCase() === 'all categories') return true;
  return getAllowedActivities(record).includes(activityName.trim().toLowerCase());
}
