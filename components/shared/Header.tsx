'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, User, Menu } from 'lucide-react';

interface HeaderProps {
  userEmail?: string;
  userName?: string;
  onMenuClick?: () => void;
}

export function Header({ userEmail, userName, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-14 border-b border-zinc-800/60 bg-black/80 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        aria-label="Menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="hidden md:block" />

      <div className="flex items-center gap-2 sm:gap-3">
        {(userName || userEmail) && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-400">
            <User className="w-4 h-4" />
            <span className="max-w-[160px] truncate">{userName ?? userEmail}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs sm:text-sm"
        >
          <LogOut className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  );
}
