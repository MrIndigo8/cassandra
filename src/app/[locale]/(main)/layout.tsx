import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { ConsentBanner } from '@/components/ConsentBanner';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-16 md:pb-0">
        {children}
      </main>
      <MobileBottomNav />
      <ConsentBanner />
    </div>
  );
}
