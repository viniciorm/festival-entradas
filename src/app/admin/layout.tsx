import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Administración — FDVC 2026',
  description: 'Panel de administración del Festival Nacional Danza del Vientre Chile 2026.',
  robots: 'noindex, nofollow',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
