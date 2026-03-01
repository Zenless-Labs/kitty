import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import '@mysten/dapp-kit/dist/index.css';
import Providers from './providers';
import { ConnectButton } from '@mysten/dapp-kit';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SuiCrowdfund',
  description: 'Privacy-preserving team crowdfunding on Sui',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <Providers>
          <header className="border-b px-6 py-3 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-blue-600">SuiCrowdfund</a>
            <ConnectButton />
          </header>
          <main className="min-h-screen bg-gray-50">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
