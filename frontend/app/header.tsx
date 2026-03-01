'use client';
import { ConnectButton } from '@mysten/dapp-kit';
import type { Network } from './providers';

export default function Header({ network, onNetworkChange }: {
  network: Network;
  onNetworkChange: (n: Network) => void;
}) {
  return (
    <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-black/40 sticky top-0 z-50">
      <a href="/" className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        🐱 Kitty
      </a>
      <div className="flex items-center gap-3">
        <div className="flex text-sm rounded-lg overflow-hidden border border-white/10">
          {(['testnet', 'mainnet'] as Network[]).map(n => (
            <button key={n} onClick={() => onNetworkChange(n)}
              className={`px-3 py-2 font-medium transition capitalize ${
                network === n
                  ? n === 'mainnet'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-blue-500/20 text-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}>
              {n}
            </button>
          ))}
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
