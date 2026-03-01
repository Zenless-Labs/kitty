'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { buildWithdraw, buildCloseEvent } from '@/lib/contract';

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Pending', color: 'bg-red-100 text-red-700' },
  1: { label: 'SUI ✓', color: 'bg-green-100 text-green-700' },
  2: { label: 'Paypal ✓', color: 'bg-blue-100 text-blue-700' },
};

export default function OrganizerPage() {
  const { id } = useParams<{ id: string }>();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [txLoading, setTxLoading] = useState(false);

  // TODO: fetch real data from chain
  const mockParticipants = [
    { name: 'Alice', status: 1 },
    { name: 'Bob', status: 0 },
    { name: 'Charlie', status: 2 },
  ];
  const goal = 10;
  const raised = 5;
  const progress = Math.min(100, Math.round((raised / goal) * 100));

  async function handleWithdraw() {
    setTxLoading(true);
    try {
      await signAndExecute({ transaction: buildWithdraw(id) });
      alert('Withdrawn successfully!');
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(false); }
  }

  async function handleClose() {
    if (!confirm('Close this event? No more contributions will be accepted.')) return;
    setTxLoading(true);
    try {
      await signAndExecute({ transaction: buildCloseEvent(id) });
      alert('Event closed.');
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(false); }
  }

  if (!account) return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <p className="text-gray-600">Connect your wallet to access the organizer dashboard.</p>
    </div>
  );

  if (!unlocked) return (
    <div className="max-w-lg mx-auto px-6 py-24">
      <h1 className="text-2xl font-bold mb-8">Organizer Dashboard</h1>
      <div className="bg-white border rounded-lg p-6">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3" placeholder="Event password" />
        <button onClick={() => setUnlocked(true)}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Unlock Dashboard
        </button>
      </div>
    </div>
  );

  const pending = mockParticipants.filter(p => p.status === 0);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Organizer Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={handleWithdraw} disabled={txLoading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Withdraw
          </button>
          <button onClick={handleClose} disabled={txLoading}
            className="border border-red-600 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
            Close Event
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium">{raised} / {goal} SUI ({progress}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-sm font-medium mb-1">Still pending ({pending.length})</p>
          <p className="text-red-600 text-sm">{pending.map(p => p.name).join(', ')}</p>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {mockParticipants.map(p => (
              <tr key={p.name} className={`border-b last:border-0 ${p.status === 0 ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[p.status].color}`}>
                    {STATUS_LABELS[p.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
