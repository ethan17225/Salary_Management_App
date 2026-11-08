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
      <div className="head">
        <div>
          <p className="eyebrow">Paycheques</p>
          <h1>Every deposit, by month</h1>
        </div>
        <a className="btn" href="/api/export.csv" download>
          Export to CSV
        </a>
      </div>
      <PaychequeLedger
        sources={data.sources}
        paycheques={data.paycheques}
        years={data.years}
        initialFilters={filters}
      />
    </section>
  );
}

