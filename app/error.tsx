"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button className="mt-4 text-sm text-primary underline" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
