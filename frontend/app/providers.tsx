'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, createNetworkConfig, useNetworkVariable } from '@mysten/dapp-kit';
import { useState } from 'react';

export type Network = 'testnet' | 'mainnet';

const { networkConfig } = createNetworkConfig({
  testnet: { url: 'https://fullnode.testnet.sui.io:443' },
  mainnet: { url: 'https://fullnode.mainnet.sui.io:443' },
});

export { networkConfig };

export default function Providers({ children, network, onNetworkChange }: {
  children: React.ReactNode;
  network: Network;
  onNetworkChange: (n: Network) => void;
}) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} network={network} onNetworkChange={onNetworkChange}>
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
