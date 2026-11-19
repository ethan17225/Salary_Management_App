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
