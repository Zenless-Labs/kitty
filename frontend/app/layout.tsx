import type { Metadata } from 'next';
import './globals.css';
import '@mysten/dapp-kit/dist/index.css';
import Providers from './providers';
import Header from './header';

export const metadata: Metadata = {
  title: 'Kitty',
  description: 'Chip in together. Privately. On Sui.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <div className="relative z-10">
            <Header />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
