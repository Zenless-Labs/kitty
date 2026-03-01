'use client';

import './globals.css';
import '@mysten/dapp-kit/dist/index.css';
import Providers, { type Network } from './providers';
import Header from './header';
import { useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<Network>('testnet');
  return (
    <html lang="en" className="dark">
      <body>
        <Providers network={network} onNetworkChange={setNetwork}>
          <div className="relative z-10">
            <Header network={network} onNetworkChange={setNetwork} />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
