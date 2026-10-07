import { createNode, getFieldValue, getNodes, updateNode, type GenesisNode } from '@/lib/genesis-data';

const CALENDAR_PROJECT_ID = 'iG1Cr94QBuatx9yK';
const EVENT_UID_FIELD = 'Source Event UID';
const SCHOOL_TIME_ZONE = 'America/Los_Angeles';
const WRITE_BATCH_SIZE = 8;

export type ArbiterSyncProgress = { processed: number; total: number };
export type ArbiterSyncResult = { added: number; updated: number; unchanged: number; skipped: number };

type IcsEvent = {
  uid: string;
  title: string;
  start: string;
  end: string;
  location: string;
  notes: string;
  status: string;
};

type CalendarValues = {
  'Activity ID': string;
  'Activity Name': string;
  'Event Title': string;
  Date: string;
  'Start Time': string;
  'End Time': string;
  Location: string;
  Notes: string;
  'Source Event UID': string;
};

let activeSync: Promise<ArbiterSyncResult> | null = null;

export function syncArbiterCalendar(
  sourceUrl: string,
  activityId: string,
  activityName: string,
  onProgress?: (progress: ArbiterSyncProgress) => void,
): Promise<ArbiterSyncResult> {
  if (activeSync != null) return activeSync;
  activeSync = performSync(sourceUrl, activityId, activityName, onProgress).finally(() => {
    activeSync = null;
  });
  return activeSync;
}

async function performSync(
  sourceUrl: string,
  activityId: string,
  activityName: string,
  onProgress?: (progress: ArbiterSyncProgress) => void,
): Promise<ArbiterSyncResult> {
  const parsedUrl = new URL(sourceUrl);
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('Calendar URL must use HTTP or HTTPS.');
  }

  const response = await fetch(parsedUrl.toString(), { headers: { Accept: 'text/calendar, text/plain;q=0.9' } });
  if (!response.ok) throw new Error(`The calendar feed returned HTTP ${response.status}.`);
  const body = await response.text();
  if (!body.includes('BEGIN:VCALENDAR')) throw new Error('The URL did not return a valid iCalendar feed.');

  const parsedEvents = parseIcs(body);
  const events = parsedEvents.filter((event) => event.uid !== '' && event.title !== '' && event.status !== 'CANCELLED');
  if (events.length === 0) throw new Error('The feed contains no importable events.');

  const existingRows = await getNodes(CALENDAR_PROJECT_ID);
  const rowsByUid = new Map<string, GenesisNode>();
  for (const row of existingRows) {
    const uid = getFieldValue(row, EVENT_UID_FIELD)?.trim();
    if (uid != null && uid !== '' && !rowsByUid.has(uid)) rowsByUid.set(uid, row);
  }

  const uniqueEvents: IcsEvent[] = [];
  const seenUids = new Set<string>();
  let skipped = parsedEvents.length - events.length;
  for (const event of events) {
    if (seenUids.has(event.uid)) {
      skipped += 1;
      continue;
    }
    seenUids.add(event.uid);
    uniqueEvents.push(event);
  }

  const result: ArbiterSyncResult = { added: 0, updated: 0, unchanged: 0, skipped };
  for (let offset = 0; offset < uniqueEvents.length; offset += WRITE_BATCH_SIZE) {
    const batch = uniqueEvents.slice(offset, offset + WRITE_BATCH_SIZE);
    await Promise.all(batch.map(async (event) => {
      const start = parseIcsDate(event.start);
      if (start == null) {
        result.skipped += 1;
        return;
      }
      const end = parseIcsDate(event.end);
      const values: CalendarValues = {
        'Activity ID': activityId,
        'Activity Name': activityName,
        'Event Title': event.title,
        Date: start.date,
        'Start Time': start.time,
        'End Time': end?.time ?? '',
        Location: event.location,
        Notes: event.notes,
        'Source Event UID': event.uid,
      };
      const current = rowsByUid.get(event.uid);
      if (current == null) {
        const createValues: Record<string, string> = { ...values };
        for (const key of ['Start Time', 'End Time', 'Location', 'Notes'] as const) {
          if (createValues[key] === '') delete createValues[key];
        }
        const write = await createNode(CALENDAR_PROJECT_ID, createValues);
        if (write.ignoredKeys.length > 0) throw new Error(`Some calendar fields were not saved: ${write.ignoredKeys.join(', ')}.`);
        result.added += 1;
        return;
      }
      if (!sameEvent(current, values)) {
        const write = await updateNode(CALENDAR_PROJECT_ID, current.id, values);
        if (write.ignoredKeys.length > 0) throw new Error(`Some calendar fields were not updated: ${write.ignoredKeys.join(', ')}.`);
        result.updated += 1;
      } else {
        result.unchanged += 1;
      }
    }));
    onProgress?.({ processed: Math.min(offset + batch.length, uniqueEvents.length), total: uniqueEvents.length });
  }
  return result;
}

function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { uid: '', title: '', start: '', end: '', location: '', notes: '', status: '' };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current != null) events.push(current);
      current = null;
      continue;
    }
    if (current == null) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const propertyName = line.slice(0, separator).split(';', 1)[0].toUpperCase();
    const value = unescapeIcsText(line.slice(separator + 1));
    if (propertyName === 'UID') current.uid = value.trim();
    if (propertyName === 'SUMMARY') current.title = value.trim();
    if (propertyName === 'DTSTART') current.start = value.trim();
    if (propertyName === 'DTEND') current.end = value.trim();
    if (propertyName === 'LOCATION') current.location = value.trim();
    if (propertyName === 'DESCRIPTION') current.notes = value.trim();
    if (propertyName === 'STATUS') current.status = value.trim().toUpperCase();
  }
  return events;
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function parseIcsDate(value: string): { date: string; time: string } | null {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly != null) return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, time: '' };

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (match == null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '0');
  if (!isValidParts(year, month, day, hour, minute, second)) return null;

  if (match[7] === 'Z') {
    const instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SCHOOL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
  }
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time: `${match[4]}:${match[5]}` };
}

function isValidParts(year: number, month: number, day: number, hour: number, minute: number, second: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && hour <= 23 && minute <= 59 && second <= 59;
}

function sameEvent(row: GenesisNode, values: CalendarValues): boolean {
  const existingDate = getFieldValue(row, 'Date') ?? '';
  return getFieldValue(row, 'Activity ID') === values['Activity ID']
    && getFieldValue(row, 'Activity Name') === values['Activity Name']
    && getFieldValue(row, 'Event Title') === values['Event Title']
    && existingDate.slice(0, 10) === values.Date
    && (getFieldValue(row, 'Start Time') ?? '') === values['Start Time']
    && (getFieldValue(row, 'End Time') ?? '') === values['End Time']
    && (getFieldValue(row, 'Location') ?? '') === values.Location
    && (getFieldValue(row, 'Notes') ?? '') === values.Notes;
}
