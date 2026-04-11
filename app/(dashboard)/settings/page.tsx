'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, User, Shield, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setName(data.user?.user_metadata?.full_name ?? '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    if (error) {
      toast.error('Error al guardar');
    } else {
      toast.success('Nombre actualizado');
      router.refresh();
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Configuración</h1>

      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <User className="w-5 h-5 text-amber-400" />
            Perfil
          </CardTitle>
          <CardDescription className="text-zinc-400">Tu información de cuenta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-zinc-400">Nombre</label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                placeholder="Tu nombre completo"
                className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 focus:border-amber-500"
              />
              <Button
                onClick={handleSaveName}
                disabled={saving || !name.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5 shrink-0"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </Button>
            </div>
            <p className="text-xs text-zinc-600">Este nombre aparece en el panel junto al botón Salir</p>
          </div>

          <div>
            <p className="text-sm text-zinc-400">Correo electrónico</p>
            <p className="font-medium text-white mt-1">{user?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Cuenta creada</p>
            <p className="text-sm text-zinc-300 mt-1">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Shield className="w-5 h-5 text-amber-400" />
            Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-300 gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
