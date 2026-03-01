'use client';
import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';

export default function Header() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

  return (
    <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-black/40 sticky top-0 z-50">
      <a href="/" className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        🐱 Kitty
      </a>
      <div className="flex items-center gap-3">
        {account ? (
          <>
            <span className="text-xs text-gray-400 font-mono hidden sm:block">
              {account.address.slice(0, 6)}…{account.address.slice(-4)}
            </span>
            <button
              onClick={() => disconnect()}
              className="text-xs text-gray-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition hover:border-white/30">
              Disconnect
            </button>
            <ConnectButton connectText="Switch Wallet" />
          </>
        ) : (
          <ConnectButton connectText="Connect Wallet" />
        )}
      </div>
    </header>
  );
}
