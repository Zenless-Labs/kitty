'use client';
import Link from 'next/link';
import { ConnectButton } from '@mysten/dapp-kit';
import { network } from './providers';

export default function Header() {
  const isMainnet = network === 'mainnet';
  return (
    <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-black/40 sticky top-0 z-50">
      <Link href="/" className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        🐱 Kitty
      </Link>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium px-3 py-2 rounded-lg border ${
          isMainnet
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        }`}>
          {network}
        </span>
        <ConnectButton />
      </div>
    </header>
  );
}
