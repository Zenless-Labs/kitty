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
      const encrypted = await encryptNames(nameList, password, salt);
      const titleEncrypted = await encryptNames([title || 'Untitled'], password, salt + '_title');
      const pwHash = await hashPassword(password);

      const saltBytes = Array.from(new TextEncoder().encode(salt.padStart(16, '0')));
      const encBytes = [...saltBytes, ...Array.from(new TextEncoder().encode(encrypted))];

      const titleSaltBytes = Array.from(new TextEncoder().encode((salt + '_title').padStart(24, '0')));
      const titleEncBytes = [...titleSaltBytes, ...Array.from(new TextEncoder().encode(titleEncrypted))];

      const goalUsdCents = Math.round(goalNum * 100);
      const deadlineTs = deadline ? BigInt(new Date(deadline).getTime()) : BigInt(0);

      const tx = buildCreateEvent({
        titleEncrypted: titleEncBytes,
        encryptedParticipants: encBytes,
        passwordHash: Array.from(pwHash),
        names: nameList,
        goalUsdCents,
        deadline: deadlineTs,
      });

      tx.setSender(account!.address);
      tx.setExpiration({ None: true } as any);
      const bytes = await tx.build({ client });
      const b64 = btoa(String.fromCharCode(...bytes));

      const res = await signAndExecute({ transaction: b64 as any });
      const created: any[] = (res as any).effects?.created ?? [];
      const eventObj = created.find((o: any) => o.owner?.Shared !== undefined || o.owner === 'Shared');
      const eventId = eventObj?.reference?.objectId ?? null;
      const digest = (res as any).digest ?? (res as any).effects?.transactionDigest ?? '';
      setResult(eventId ? `event:${eventId}` : `digest:${digest}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!account) return (
    <div className="max-w-lg mx-auto px-6 py-32 text-center">
      <p className="text-gray-400 mb-4">Connect your wallet to create an event.</p>
    </div>
  );

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition";
  const labelCls = "block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider";

  return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        Create Event
      </h1>
      <p className="text-gray-500 text-sm mb-8">Participants are encrypted on-chain. Only people with the password can see who&apos;s in.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelCls}>Event Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            className={inputCls} placeholder="Team dinner April 2026" required />
        </div>
        <div>
          <label className={labelCls}>Participants (one per line)</label>
          <textarea value={names} onChange={e => setNames(e.target.value)} rows={5}
            className={inputCls} placeholder={"Alice\nBob\nCharlie"} required />
          {numParticipants > 0 && <p className="text-xs text-gray-500 mt-1">{numParticipants} participant{numParticipants > 1 ? 's' : ''}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Goal (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500 text-sm">$</span>
              <input type="number" step="0.01" min="0" value={goalUsd} onChange={e => setGoalUsd(e.target.value)}
                className={inputCls + " pl-7"} placeholder="100" required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Deadline (optional)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
          </div>
        </div>

        {goalNum > 0 && numParticipants > 0 && (
          <div className="card p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Per person</span>
              <span className="font-semibold text-white">${perPersonUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">SUI price {priceLoading ? '…' : price ? `$${price.toFixed(3)}` : 'unavailable'}</span>
              <span className="text-gray-300">{perPersonSui ? `≈ ${perPersonSui.toFixed(3)} SUI` : '—'}</span>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {result && result.startsWith('event:') && (
          <div className="card p-4 border-green-500/20 bg-green-500/5">
            <p className="text-green-400 text-sm font-semibold mb-2">✓ Event created!</p>
            <p className="text-gray-400 text-xs font-mono break-all mb-3">{result.slice(6)}</p>
            <a href={`/event/${result.slice(6)}`}
              className="inline-block text-sm text-blue-400 hover:text-blue-300 transition">
              View event →
            </a>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold hover:opacity-90 disabled:opacity-40 transition shadow-lg shadow-blue-500/20">
          {loading ? 'Creating…' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}
