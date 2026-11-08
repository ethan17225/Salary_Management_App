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
      <body>
        <main className="wrap" style={{ paddingBlock: 64 }}>
          <div className="card empty">
            <h2>Could not reach the Payday server</h2>
            <p className="muted" style={{ marginTop: 8 }}>
              {error.message || 'An unexpected error occurred.'}
            </p>
            <p style={{ marginTop: 16 }}>
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

