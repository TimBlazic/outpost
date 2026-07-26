/** Calendar date in Europe/Ljubljana as YYYY-MM-DD. */
export function huntToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
