export default function CalendarLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8">
      <div className="h-24 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-md border bg-muted"
          />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-md border bg-muted" />
      <div className="grid gap-px overflow-hidden rounded-md border bg-border md:grid-cols-7">
        {Array.from({ length: 35 }).map((_, index) => (
          <div
            key={index}
            className="min-h-40 animate-pulse bg-background p-3"
          />
        ))}
      </div>
    </div>
  );
}
