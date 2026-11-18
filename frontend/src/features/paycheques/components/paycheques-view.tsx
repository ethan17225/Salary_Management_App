import { PaychequeLedger } from './paycheque-ledger';
import type { PaychequeFilterParams, PaychequesPageData } from '../types/paycheque-types';

export function PaychequesView({
  data,
  filters,
}: {
  data: PaychequesPageData;
  filters?: PaychequeFilterParams;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <p className="text-sm font-medium text-muted">Paycheques</p>
          <h1 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-medium tracking-[-0.03em] leading-[1.15]">
            Every deposit, by month
          </h1>
        </div>
        <a className="btn w-full sm:w-auto" href="/api/export.csv" download>
          Export to CSV
        </a>
      </div>
      <PaychequeLedger
        sources={data.sources}
        paycheques={data.paycheques}
        allocations={data.allocations}
        years={data.years}
        initialFilters={filters}
      />
    </section>
  );
}

