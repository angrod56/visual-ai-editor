import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/shared/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardShell
      userEmail={user.email}
      userName={user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined}
    >
      {children}
    </DashboardShell>
  );
}
