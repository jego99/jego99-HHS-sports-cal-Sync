export function formatTime12Hour(value: string): string {
  const time = value.trim();
  if (time === '') return '';

  const twentyFourHour = time.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (twentyFourHour != null) {
    const hour = Number(twentyFourHour[1]);
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${twentyFourHour[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  }

  const twelveHour = time.match(/^(1[0-2]|0?[1-9]):([0-5]\d)(?::[0-5]\d)?\s*([AP]M)$/i);
  if (twelveHour != null) {
    return `${Number(twelveHour[1])}:${twelveHour[2]} ${twelveHour[3].toUpperCase()}`;
  }

  return time;
}

export function formatTimeRange(startTime: string, endTime: string, missingStart = ''): string {
  const start = startTime.trim() === '' ? missingStart : formatTime12Hour(startTime);
  const end = endTime.trim() === '' ? '' : formatTime12Hour(endTime);
  if (start === '') return end;
  return end === '' ? start : `${start} to ${end}`;
}
