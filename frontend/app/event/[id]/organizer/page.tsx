'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { buildWithdraw, buildCloseEvent, buildMarkPaypal } from '@/lib/contract';
import { decryptNames } from '@/lib/crypto';
import { useSuiPrice } from '@/lib/useSuiPrice';

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Pending', color: 'bg-red-100 text-red-700' },
  1: { label: 'SUI ✓', color: 'bg-green-100 text-green-700' },
  2: { label: 'Paypal ✓', color: 'bg-blue-100 text-blue-700' },
};

export default function OrganizerPage() {
  const { id } = useParams<{ id: string }>();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { price } = useSuiPrice();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      client.executeTransactionBlock({ transactionBlock: bytes, signature, options: { showEffects: true } }),
  });

  const [password, setPassword] = useState('');
  const [names, setNames] = useState<string[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, number>>({});
  const [unlockError, setUnlockError] = useState('');
  const [txLoading, setTxLoading] = useState<string | null>(null);

  const { data: objData, isLoading, refetch } = useSuiClientQuery('getObject', {
    id, options: { showContent: true },
  });

  const fields = (objData?.data?.content as any)?.fields ?? null;
  const goalUsdCents: number = fields ? parseInt(fields.goal_usd_cents) : 0;
  const goalUsd = (goalUsdCents / 100).toFixed(2);
  const poolMist: number = fields ? parseInt(fields.pool?.fields?.value ?? fields.pool ?? '0') : 0;
  const tipMist: number = fields ? parseInt(fields.tip?.fields?.value ?? fields.tip ?? '0') : 0;
  const poolSui = (poolMist / 1_000_000_000).toFixed(3);
  const tipSui = (tipMist / 1_000_000_000).toFixed(3);
  const isActive: boolean = fields?.active ?? true;
  const isOrganizer = account?.address === fields?.organizer;

  const onChainStatuses: Record<string, number> = {};
  if (fields?.statuses) {
    const contents: any[] = fields.statuses.fields?.contents ?? [];
    contents.forEach((entry: any) => { onChainStatuses[entry.fields.key] = parseInt(entry.fields.value); });
  }
  const resolvedStatuses = Object.keys(statuses).length > 0 ? statuses : onChainStatuses;
  const paidCount = Object.values(resolvedStatuses).filter(s => s > 0).length;
  const totalCount = names?.length ?? Object.keys(resolvedStatuses).length;
  const goalSui = price ? (goalUsdCents / 100 / price) : null;
  const progress = goalSui && poolMist > 0 ? Math.min(100, Math.round((poolMist / 1e9 / goalSui) * 100)) : 0;

  const pending = (names ?? []).filter(n => (resolvedStatuses[n] ?? 0) === 0);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError('');
    try {
      if (!fields) throw new Error('Event not loaded');
      const encHex: number[] = fields.encrypted_participants;
      const saltBytes = encHex.slice(0, 16);
      const salt = new TextDecoder().decode(new Uint8Array(saltBytes)).replace(/\0/g, '').replace(/^0+/, '').trim();
      const encData = new TextDecoder().decode(new Uint8Array(encHex.slice(16)));
      const decrypted = await decryptNames(encData, password, salt);
      setStatuses(onChainStatuses);
      setNames(decrypted);
      // Decrypt title
      try {
        const titleHex: number[] = fields.title_encrypted;
        const titleSaltBytes = titleHex.slice(0, 24);
        const titleSaltRaw = new TextDecoder().decode(new Uint8Array(titleSaltBytes)).replace(/\0/g, '').replace(/^0+/, '').trim();
        const titleEncData = new TextDecoder().decode(new Uint8Array(titleHex.slice(24)));
        const titleArr = await decryptNames(titleEncData, password, titleSaltRaw);
        setTitle(titleArr[0] ?? null);
      } catch { setTitle(null); }
    } catch { setUnlockError('Wrong password or could not decrypt'); }
  }

  async function execTx(tx: any) {
    tx.setSender(account!.address);
    tx.setExpiration({ None: true } as any);
    const bytes = await tx.build({ client });
    const b64 = btoa(String.fromCharCode(...bytes));
    await signAndExecute({ transaction: b64 as any });
    await refetch();
  }

  async function handleMarkPaypal(name: string) {
    setTxLoading(name);
    try {
      await execTx(buildMarkPaypal(id, name));
      setStatuses(prev => ({ ...prev, [name]: 2 }));
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(null); }
  }

  async function handleWithdraw() {
    setTxLoading('withdraw');
    try {
      await execTx(buildWithdraw(id));
      alert('Withdrawn successfully!');
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(null); }
  }

  async function handleClose() {
    if (!confirm('Close this event? No more contributions will be accepted.')) return;
    setTxLoading('close');
    try {
      await execTx(buildCloseEvent(id));
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(null); }
  }

  if (!account) return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <p className="text-gray-600">Connect your wallet to access the organizer dashboard.</p>
    </div>
  );

  if (isLoading) return <div className="max-w-2xl mx-auto px-6 py-24 text-center text-gray-400">Loading…</div>;

  if (!names) return (
    <div className="max-w-lg mx-auto px-6 py-24">
      <h1 className="text-2xl font-bold mb-2">Organizer Dashboard</h1>
      <p className="text-xs font-mono text-gray-400 mb-8 break-all">{id}</p>
      {!isOrganizer && fields && (
        <p className="text-red-600 text-sm mb-4">⚠ Your wallet is not the organizer of this event.</p>
      )}
      <div className="bg-white border rounded-lg p-6">
        <form onSubmit={handleUnlock}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3" placeholder="Event password" />
          {unlockError && <p className="text-red-600 text-sm mb-3">{unlockError}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Unlock Dashboard
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between mb-6">
        <div>
          {title && <h1 className="text-2xl font-bold mb-1">{title}</h1>}
          <p className="text-xs font-mono text-gray-400 break-all">{id}</p>
          {!isActive && <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Closed</span>}
        </div>
        <div className="flex gap-2 shrink-0 ml-4">
          <button onClick={handleWithdraw} disabled={!!txLoading || poolMist === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {txLoading === 'withdraw' ? 'Withdrawing…' : `Withdraw ${poolSui} SUI`}
          </button>
          {isActive && (
            <button onClick={handleClose} disabled={!!txLoading}
              className="border border-red-600 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50">
              {txLoading === 'close' ? 'Closing…' : 'Close Event'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Goal', value: `$${goalUsd}` },
          { label: 'Pool', value: `${poolSui} SUI` },
          { label: 'Tips', value: `${tipSui} SUI` },
          { label: 'Paid', value: `${paidCount}/${totalCount}` },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="font-semibold text-sm mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">SUI collected</span>
          <span className="font-medium">{progress}%{goalSui ? ` (${poolSui} / ${goalSui.toFixed(2)} SUI)` : ''}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-sm font-medium">Still pending: {pending.join(', ')}</p>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {names.map(name => {
              const status = resolvedStatuses[name] ?? 0;
              return (
                <tr key={name} className={`border-b last:border-0 ${status === 0 ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[status].color}`}>
                      {STATUS_LABELS[status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {status === 0 && isActive && isOrganizer && (
                      <button
                        onClick={() => handleMarkPaypal(name)}
                        disabled={!!txLoading}
                        className="text-xs border border-blue-500 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-50 disabled:opacity-50">
                        {txLoading === name ? 'Marking…' : 'Mark PayPal'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
