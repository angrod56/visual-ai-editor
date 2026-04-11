import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'VisualAI Editor — Edición de video con IA',
  description:
    'Edita tus videos usando lenguaje natural. Powered by Claude AI + FFmpeg.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased font-sans bg-zinc-950 text-white">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
