import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  format,
  getDay,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { es } from "date-fns/locale";

export type CalendarMode = "month" | "weekend";

function parseDateParam(value: string | undefined) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function getUpcomingWeekendStart(now: Date) {
  const today = startOfDay(now);
  const day = getDay(today);

  if ([5, 6, 0].includes(day)) {
    const daysSinceFriday = day === 0 ? 2 : day - 5;
    return addDays(today, -daysSinceFriday);
  }

  return addDays(today, 5 - day);
}

function getWeekendStart(date: Date) {
  const day = getDay(date);
  if ([5, 6, 0].includes(day)) {
    const daysSinceFriday = day === 0 ? 2 : day - 5;
    return addDays(startOfDay(date), -daysSinceFriday);
  }

  return getUpcomingWeekendStart(date);
}

export function getCalendarRange({
  mode,
  date,
  now = new Date(),
}: {
  mode: CalendarMode;
  date?: string;
  now?: Date;
}) {
  const parsedDate = parseDateParam(date);

  if (mode === "weekend") {
    const start = getWeekendStart(parsedDate ?? now);
    const end = endOfDay(addDays(start, 2));
    const previous = addWeeks(start, -1);
    const next = addWeeks(start, 1);

    return {
      from: start,
      to: end,
      date: format(start, "yyyy-MM-dd"),
      previousDate: format(previous, "yyyy-MM-dd"),
      nextDate: format(next, "yyyy-MM-dd"),
      label: `${format(start, "d MMM", { locale: es })} - ${format(end, "d MMM yyyy", { locale: es })}`,
    };
  }

  const start = startOfMonth(parsedDate ?? now);
  const end = endOfMonth(start);
  const previous = addMonths(start, -1);
  const next = addMonths(start, 1);

  return {
    from: startOfDay(start),
    to: endOfDay(end),
    date: format(start, "yyyy-MM-dd"),
    previousDate: format(previous, "yyyy-MM-dd"),
    nextDate: format(next, "yyyy-MM-dd"),
    label: format(start, "MMMM yyyy", { locale: es }),
  };
}
