'use client';
import { ConnectButton } from '@mysten/dapp-kit';

export default function Header() {
  return (
    <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-black/40 sticky top-0 z-50">
      <a href="/" className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        🐱 Kitty
      </a>
      <ConnectButton />
    </header>
  );
}
