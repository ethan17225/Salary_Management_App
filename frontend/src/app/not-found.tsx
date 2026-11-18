import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 pt-8 pb-20">
      <div className="card py-12 px-4 text-center text-muted">
        <p className="text-ink">Page or source not found.</p>
        <p className="mt-3">
          <Link className="btn" href="/">
            Back to Overview
          </Link>
        </p>
      </div>
    </main>
  );
}

