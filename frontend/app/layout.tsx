import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import '@mysten/dapp-kit/dist/index.css';
import Providers from './providers';
import Header from './header';

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
          <Header />
          <main className="min-h-screen bg-gray-50">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
