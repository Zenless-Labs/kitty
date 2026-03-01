'use client';
import { ConnectButton } from '@mysten/dapp-kit';

export default function Header() {
  return (
    <header className="border-b px-6 py-3 flex items-center justify-between">
      <a href="/" className="text-xl font-bold text-blue-600">SuiCrowdfund</a>
      <ConnectButton />
    </header>
  );
}
