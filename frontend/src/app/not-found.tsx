import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap">
      <div className="card empty">
        <p>Page or source not found.</p>
        <p style={{ marginTop: 12 }}>
          <Link className="btn" href="/">
            Back to Overview
          </Link>
        </p>
      </div>
    </main>
  );
}

