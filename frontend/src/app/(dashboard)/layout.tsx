import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { DialogProvider } from '@/components/ui/dialog-provider';
import { getPaychequesData, PaychequeDialog } from '@/features/paycheques';
import { SourceDialog } from '@/features/sources';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { sources, paycheques } = await getPaychequesData();

  return (
    <DialogProvider>
      <Navbar />
      <main id="main" className="wrap" tabIndex={-1}>
        {children}
      </main>
      <PaychequeDialog sources={sources} paycheques={paycheques} />
      <SourceDialog sources={sources} />
    </DialogProvider>
  );
}

