'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { useState } from 'react';

const network = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const rpcUrl = process.env.NEXT_PUBLIC_SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443';

const { networkConfig } = createNetworkConfig({
  [network]: { url: rpcUrl },
});

export { network };

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={network}>
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
