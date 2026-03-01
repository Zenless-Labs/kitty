'use client';

import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { encryptNames, hashPassword } from '@/lib/crypto';
import { buildCreateEvent } from '@/lib/contract';
import { useSuiPrice } from '@/lib/useSuiPrice';

export default function CreatePage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { price, loading: priceLoading, usdToSui } = useSuiPrice();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      client.executeTransactionBlock({ transactionBlock: bytes, signature, options: { showEffects: true } }),
  });

  const [title, setTitle] = useState('');
  const [names, setNames] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [goalUsd, setGoalUsd] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameList = names.split('\n').map(n => n.trim()).filter(Boolean);
  const numParticipants = nameList.length;
  const goalNum = parseFloat(goalUsd) || 0;
  const perPersonUsd = numParticipants > 0 ? goalNum / numParticipants : 0;
  const perPersonSui = usdToSui(perPersonUsd);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (nameList.length === 0) { setError('Add at least one participant'); return; }

    setLoading(true);
    try {
      const salt = Date.now().toString();
      // Encrypt title with same key
      const titleEncrypted = await encryptNames([title || 'Untitled'], password, salt + '_title');
      const encrypted = await encryptNames(nameList, password, salt);
      const pwHash = await hashPassword(password);
      const saltBytes = Array.from(new TextEncoder().encode(salt.padStart(16, '0')));
      const encBytes = [...saltBytes, ...Array.from(new TextEncoder().encode(encrypted))];

      const goalUsdCents = Math.round(goalNum * 100);
      const deadlineTs = deadline ? BigInt(new Date(deadline).getTime()) : BigInt(0);

      const titleSaltBytes = Array.from(new TextEncoder().encode((salt + '_title').padStart(24, '0')));
      const titleEncBytes = [...titleSaltBytes, ...Array.from(new TextEncoder().encode(titleEncrypted))];

      const tx = buildCreateEvent({
        titleEncrypted: titleEncBytes,
        encryptedParticipants: encBytes,
        passwordHash: Array.from(pwHash),
        names: nameList,
        goalUsdCents,
        deadline: deadlineTs,
      });

      // Build to raw bytes and pass as base64 string — bypasses wallet SDK version mismatch
      tx.setSender(account!.address);
      tx.setExpiration({ None: true } as any); // must be truthy to survive applyResolvedData // force None — older wallets do not support ValidDuring(2)
      const bytes = await tx.build({ client });
      const b64 = btoa(String.fromCharCode(...bytes));
      console.log('[create] tx bytes len:', bytes.length, 'sending to wallet...');

      const res = await signAndExecute({ transaction: b64 as any });
      console.log('[create] success:', res);
      // Extract the CrowdFundEvent shared object ID from effects
      // @ts-ignore
      const created: any[] = res.effects?.created ?? [];
      const eventObj = created.find((o: any) => o.owner?.Shared !== undefined || o.owner === 'Shared');
      const eventId = eventObj?.reference?.objectId ?? null;
      // @ts-ignore
      const digest = res.digest ?? res.effects?.transactionDigest ?? '';
      console.log('[create] created objects:', created, 'eventId:', eventId);
      setResult(eventId ? `event:${eventId}` : `digest:${digest}`);
    } catch (err) {
      console.error('[create] error:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!account) return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <p className="text-gray-600">Connect your wallet to create an event.</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">Create Crowdfund Event</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Team dinner April 2026" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Participants (one per line)</label>
          <textarea value={names} onChange={e => setNames(e.target.value)} rows={6}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Alice&#10;Bob&#10;Charlie" required />
          {numParticipants > 0 && <p className="text-xs text-gray-500 mt-1">{numParticipants} participant{numParticipants > 1 ? 's' : ''}</p>}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
              <input type="number" step="0.01" min="0" value={goalUsd} onChange={e => setGoalUsd(e.target.value)}
                className="w-full border rounded-lg pl-6 pr-3 py-2 text-sm" placeholder="100" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (optional)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        {goalNum > 0 && numParticipants > 0 && (
          <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-700">
              <span>Per person</span>
              <span className="font-medium">${perPersonUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>SUI price {priceLoading ? '…' : price ? `$${price.toFixed(3)}` : 'unavailable'}</span>
              <span>{perPersonSui ? `≈ ${perPersonSui.toFixed(3)} SUI` : '—'}</span>
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <p className="text-green-800 text-sm font-medium">✓ Event created!</p>
            {result.startsWith('event:') ? (
              <>
                <p className="text-green-700 text-xs font-mono break-all">{result.slice(6)}</p>
                <a href={`/event/${result.slice(6)}`}
                  className="inline-block mt-1 text-sm text-blue-600 underline">
                  View event →
                </a>
              </>
            ) : (
              <p className="text-green-700 text-xs font-mono break-all">{result}</p>
            )}
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
