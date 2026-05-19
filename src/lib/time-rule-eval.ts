// Shared helper for evaluating link_time_rules against "now" in a given timezone.
// Used by redirect.functions.ts (server-side).

type Rule = {
  days_mask: number;
  start_minute: number;
  end_minute: number;
  action: "safe" | "cloak" | "pass";
  timezone: string | null;
  priority: number;
};

function minutesInTz(date: Date, tz: string): { dow: number; minute: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const w = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dow: dowMap[w] ?? 0, minute: h * 60 + m };
  } catch {
    const d = new Date(date.toISOString());
    return { dow: d.getUTCDay(), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
}

function ruleMatches(r: Rule, now: Date): boolean {
  const { dow, minute } = minutesInTz(now, r.timezone || "UTC");
  if (((r.days_mask >> dow) & 1) === 0) return false;
  if (r.start_minute <= r.end_minute) {
    return minute >= r.start_minute && minute < r.end_minute;
  }
  // window wraps midnight
  return minute >= r.start_minute || minute < r.end_minute;
}

export function pickActiveTimeRule(rules: Rule[], now = new Date()): "safe" | "cloak" | "pass" | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (ruleMatches(r, now)) return r.action;
  }
  return null;
}
