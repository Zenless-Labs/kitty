'use client';

import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { encryptNames, hashPassword } from '@/lib/crypto';
import { buildCreateEvent } from '@/lib/contract';

export default function CreatePage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [names, setNames] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [goalSui, setGoalSui] = useState('');
  const [deadline, setDeadline] = useState('');
  const [creatorCapId, setCreatorCapId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!account) { setError('Connect your wallet first'); return; }

    setLoading(true);
    try {
      const nameList = names.split('\n').map(n => n.trim()).filter(Boolean);
      if (nameList.length === 0) { setError('Add at least one participant'); return; }

      const salt = Date.now().toString();
      const encrypted = await encryptNames(nameList, password, salt);
      const pwHash = await hashPassword(password);

      // Store salt alongside encrypted data (prepend as 16-char hex padded)
      const saltHex = Array.from(new TextEncoder().encode(salt.padStart(16, '0')))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const fullData = saltHex + encrypted;
      const encBytes = Array.from(new TextEncoder().encode(fullData));

      const goalMist = BigInt(Math.round(parseFloat(goalSui) * 1_000_000_000));
      const deadlineTs = deadline ? BigInt(new Date(deadline).getTime()) : 0n;

      const tx = buildCreateEvent({
        creatorCapId,
        encryptedParticipants: encBytes,
        passwordHash: Array.from(pwHash),
        names: nameList,
        goalMist,
        deadline: deadlineTs,
      });

      const res = await signAndExecute({ transaction: tx });
      setResult(res.digest);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!account) return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <p className="text-gray-600 mb-4">Connect your wallet to create an event.</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">Create Crowdfund Event</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CreatorCap Object ID</label>
          <input value={creatorCapId} onChange={e => setCreatorCapId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="0x..." required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Participants (one per line)</label>
          <textarea value={names} onChange={e => setNames(e.target.value)} rows={6}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Alice&#10;Bob&#10;Charlie" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal (SUI)</label>
            <input type="number" step="0.1" min="0" value={goalSui} onChange={e => setGoalSui(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="10" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (optional)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm font-medium">Event created!</p>
            <p className="text-green-700 text-xs font-mono mt-1 break-all">{result}</p>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition">
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}
