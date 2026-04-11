'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

interface HeaderProps {
  userEmail?: string;
  userName?: string;
}

export function Header({ userEmail, userName }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-14 border-b border-zinc-800/60 bg-black/80 backdrop-blur-sm flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        {(userName || userEmail) && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <User className="w-4 h-4" />
            <span>{userName ?? userEmail}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <LogOut className="w-4 h-4 mr-1" />
          Salir
        </Button>
      </div>
    </header>
  );
}
