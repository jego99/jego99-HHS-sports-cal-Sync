import type { GenesisNode } from '@/lib/genesis-data';
import { getFieldValue } from '@/lib/genesis-data';
import { normalizeEmail } from '@/lib/access-control';

export const SUPER_ADMINS_PROJECT_ID = 'BUViZeBiYc1ttDDT';
export const SUPER_ADMIN_STATUS_ACTIVE = 'active';

export type SuperAdminRecord = {
  id: string;
  email: string;
  displayName: string;
  status: string;
};

export function readSuperAdmin(row: GenesisNode): SuperAdminRecord {
  return {
    id: row.id,
    email: getFieldValue(row, 'Email') ?? '',
    displayName: getFieldValue(row, 'Display Name') ?? '',
    status: getFieldValue(row, 'Status') ?? 'active',
  };
}

export function isActiveSuperAdmin(rows: GenesisNode[], email: string | null | undefined) {
  const target = normalizeEmail(email);
  return target.length > 0 && rows.map(readSuperAdmin).some((record) => normalizeEmail(record.email) === target && record.status.trim().toLowerCase() === SUPER_ADMIN_STATUS_ACTIVE);
}
