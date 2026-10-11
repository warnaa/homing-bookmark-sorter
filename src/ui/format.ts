const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Formats an activity timestamp compactly: a clock time for today, a weekday
 * within the last week, and a short date otherwise.
 */
export function formatActivityTime(
  timestamp: number,
  now: number,
  locale: string,
): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS);
  const options: Intl.DateTimeFormatOptions =
    days <= 0
      ? { timeStyle: "short" }
      : days < 7
        ? { weekday: "short" }
        : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat(locale, options).format(timestamp);
}
