import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';
import { SidebarProvider } from '@/lib/sidebarContext';
import { AuthGuard } from '@/components/AuthGuard';
import { ToastProvider } from '@/components/ToastProvider';

export const metadata: Metadata = {
  title: 'Observation Studio — Classroom Video Research Platform',
  description: 'Multimodal classroom video analysis and qualitative strategy research platform for English teaching methods.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

import { UploadProvider } from '@/lib/uploadContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <I18nProvider>
          <ToastProvider>
            <UploadProvider>
              <SidebarProvider>
                <AuthGuard>
                  {children}
                </AuthGuard>
              </SidebarProvider>
            </UploadProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
