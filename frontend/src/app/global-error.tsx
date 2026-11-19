'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="m-0 bg-bg text-ink font-sans text-base leading-normal antialiased">
        <main className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 py-16">
          <div className="card py-12 px-4 text-center text-muted">
            <h1 className="text-base font-medium tracking-[-0.01em] text-ink">
              Could not reach the Payday server
            </h1>
            <p className="mt-2 text-muted">
              {error.message || 'An unexpected error occurred.'}
            </p>
            <p className="mt-4">
              <button type="button" className="btn primary" onClick={() => reset()}>
                Try again
              </button>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}

