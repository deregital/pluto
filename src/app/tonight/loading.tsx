export default function TonightLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-24">
      <div className="h-24 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-md border bg-muted"
          />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-md border bg-muted"
          />
        ))}
      </div>
    </div>
  );
}
