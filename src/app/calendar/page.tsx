import { redirect } from "next/navigation";

import CalendarDashboard from "@/components/calendar/CalendarDashboard";
import {
  type CalendarMode,
  getCalendarRange,
} from "@/lib/calendar-ranges";
import { auth } from "@/server/auth";
import { getPlutoCalendarEvents } from "@/server/services/pluto-calendar";

type CalendarPageProps = {
  searchParams?: Promise<{
    mode?: string;
    date?: string;
  }>;
};

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const mode: CalendarMode = params?.mode === "weekend" ? "weekend" : "month";
  const range = getCalendarRange({ mode, date: params?.date });
  const { events, failures } = await getPlutoCalendarEvents({
    from: range.from,
    to: range.to,
  });

  return (
    <CalendarDashboard
      events={events}
      failures={failures}
      mode={mode}
      range={{
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        date: range.date,
        previousDate: range.previousDate,
        nextDate: range.nextDate,
        label: range.label,
      }}
    />
  );
}
