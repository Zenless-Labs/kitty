'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { decryptNames } from '@/lib/crypto';
import { buildContributeSui, buildContributeSuiWithTip, buildMarkPaypal } from '@/lib/contract';

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  1: { label: 'SUI ✓', color: 'bg-green-100 text-green-700' },
  2: { label: 'Paypal ✓', color: 'bg-blue-100 text-blue-700' },
};

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [password, setPassword] = useState('');
  const [names, setNames] = useState<string[] | null>(null);
  const [unlockError, setUnlockError] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [amountSui, setAmountSui] = useState('');
  const [tipSui, setTipSui] = useState('');
  const [txLoading, setTxLoading] = useState(false);

  // TODO: fetch real event data from chain using useSuiClientQuery
  const mockEvent = { goal: '10 SUI', contributed: 0, total: 0, encryptedData: '', salt: '' };

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError('');
    try {
      // TODO: get encrypted data + salt from on-chain event object
      // For now show placeholder
      setNames(['Alice', 'Bob', 'Charlie']);
    } catch {
      setUnlockError('Wrong password or could not decrypt');
    }
  }

  async function handleContributeSui() {
    if (!selectedName || !amountSui) return;
    setTxLoading(true);
    try {
      const amountMist = BigInt(Math.round(parseFloat(amountSui) * 1_000_000_000));
      const tipMist = tipSui ? BigInt(Math.round(parseFloat(tipSui) * 1_000_000_000)) : 0n;
      const tx = tipMist > 0n
        ? buildContributeSuiWithTip({ eventId: id, name: selectedName, amountMist, tipMist })
        : buildContributeSui({ eventId: id, name: selectedName, amountMist });
      await signAndExecute({ transaction: tx });
      alert('Contribution successful!');
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(false); }
  }

  async function handleMarkPaypal() {
    if (!selectedName) return;
    setTxLoading(true);
    try {
      const tx = buildMarkPaypal(id, selectedName);
      await signAndExecute({ transaction: tx });
      alert('Marked as paid via Paypal!');
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-xs text-gray-400 font-mono mb-1">Event</p>
      <h1 className="text-xl font-bold font-mono mb-6 break-all">{id}</h1>

      <div className="bg-white border rounded-lg p-4 mb-8 grid grid-cols-3 gap-4 text-center">
        <div><p className="text-xs text-gray-500">Goal</p><p className="font-semibold">{mockEvent.goal}</p></div>
        <div><p className="text-xs text-gray-500">Raised</p><p className="font-semibold">-- SUI</p></div>
        <div><p className="text-xs text-gray-500">Contributed</p><p className="font-semibold">?/?</p></div>
      </div>

      {!names ? (
        <form onSubmit={handleUnlock} className="bg-white border rounded-lg p-6">
          <h2 className="font-semibold mb-4">Enter password to view participants</h2>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3" placeholder="Event password" />
          {unlockError && <p className="text-red-600 text-sm mb-3">{unlockError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Unlock
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Status</th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody>
                {names.map(name => (
                  <tr key={name} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedName(name)}>
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[0].color}`}>
                        {STATUS_LABELS[0].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {selectedName === name && <span className="text-blue-600 text-xs">selected</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedName && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="font-semibold mb-4">Contribute as <span className="text-blue-600">{selectedName}</span></h2>
              {!account && <p className="text-sm text-gray-500 mb-4">Connect wallet to contribute with SUI</p>}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Amount (SUI)</label>
                  <input type="number" step="0.1" min="0" value={amountSui} onChange={e => setAmountSui(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="5" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Tip for organizer (optional)</label>
                  <input type="number" step="0.01" min="0" value={tipSui} onChange={e => setTipSui(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0.1" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleContributeSui} disabled={txLoading || !account}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  Pay with SUI
                </button>
                <button onClick={handleMarkPaypal} disabled={txLoading || !account}
                  className="flex-1 border border-blue-600 text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50">
                  Mark as Paypal
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
