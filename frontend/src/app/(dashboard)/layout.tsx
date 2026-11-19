import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { DialogProvider } from '@/components/ui/dialog-provider';
import { getPaychequesData, PaychequeDialog } from '@/features/paycheques';
import { SourceDialog } from '@/features/sources';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { sources, paycheques, allocations } = await getPaychequesData();

  return (
    <DialogProvider>
      <Navbar />
      <main
        id="main"
        className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 pt-8 pb-20 outline-none"
        tabIndex={-1}
      >
        {children}
      </main>
      <PaychequeDialog sources={sources} paycheques={paycheques} allocations={allocations} />
      <SourceDialog sources={sources} />
    </DialogProvider>
  );
}

