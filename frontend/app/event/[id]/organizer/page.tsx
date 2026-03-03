'use client';
import Link from 'next/link';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { buildWithdraw, buildCloseEvent, buildMarkPaypalBatch } from '@/lib/contract';
import { decryptEvent, parseStatuses, savePassword, loadPassword } from '@/lib/kitty';
import { useSuiPrice } from '@/lib/useSuiPrice';

const STATUS = {
  0: { label: 'Pending',  cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  1: { label: 'SUI ✓',   cls: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  2: { label: 'PayPal ✓',cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  3: { label: 'USDC ✓',  cls: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' },
} as Record<number, {label:string;cls:string}>;

export default function OrganizerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { price } = useSuiPrice();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      client.executeTransactionBlock({ transactionBlock: bytes, signature, options: { showEffects: true } }),
  });

  const [password, setPassword] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [names, setNames] = useState<string[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, number>>({});
  const [unlockError, setUnlockError] = useState('');
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: objData, isLoading, refetch } = useSuiClientQuery('getObject', {
    id, options: { showContent: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields = (objData?.data?.content as any)?.fields ?? null;
  const goalUsdCents: number = fields ? parseInt(fields.goal_usd_cents) : 0;
  const goalUsd = (goalUsdCents / 100).toFixed(2);
  const poolMist: number = fields ? parseInt(fields.pool_sui?.fields?.value ?? fields.pool_sui ?? fields.pool?.fields?.value ?? fields.pool ?? '0') : 0;
  const poolUsdcRaw: number = fields ? parseInt(fields.pool_coin?.fields?.value ?? fields.pool_coin ?? '0') : 0;
  const poolUsdc = (poolUsdcRaw / 1e6).toFixed(2);
  const tipPoolMist: number = fields ? parseInt(fields.tip?.fields?.value ?? fields.tip ?? '0') : 0;
  const tipPoolSui = (tipPoolMist / 1e9).toFixed(3);
  const totalRaisedUsd = (() => {
    const suiUsd = price ? (poolMist / 1e9) * price : 0;
    const usdcUsd = poolUsdcRaw / 1e6;
    return suiUsd + usdcUsd;
  })();
  const tipMist: number = fields ? parseInt(fields.tip?.fields?.value ?? fields.tip ?? '0') : 0;
  const poolSui = (poolMist / 1e9).toFixed(3);
  const tipSui = (tipMist / 1e9).toFixed(3);
  const isActive: boolean = fields?.active ?? true;
  const isOrganizer = account?.address === fields?.organizer;

  const onChainStatuses = parseStatuses(fields);
  const resolvedStatuses = Object.keys(statuses).length > 0 ? statuses : onChainStatuses;
  const paidCount = Object.values(resolvedStatuses).filter(s => s > 0).length;
  const totalCount = names?.length ?? Object.keys(resolvedStatuses).length;
  const goalSui = price ? (goalUsdCents / 100 / price) : null;
  const progress = goalUsdCents > 0 && totalRaisedUsd > 0 ? Math.min(100, Math.round((totalRaisedUsd / (goalUsdCents / 100)) * 100)) : 0;
  const pending = (names ?? []).filter(n => (resolvedStatuses[n] ?? 0) === 0);

  // Auto-decrypt from URL param or localStorage
  useEffect(() => {
    if (!fields || names !== null) return;
    const pw = loadPassword(id as string);
    if (!pw) return;
    setPassword(pw);
    decryptEvent(fields, pw).then(({ names: n, title: t }) => {
      setNames(n); setTitle(t); setStatuses(parseStatuses(fields));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // 3s redirect countdown if not organizer
  useEffect(() => {
    if (!fields || !account || isOrganizer) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) { clearInterval(interval); router.replace(`/event/${id}`); return 0; }
        return (prev ?? 3) - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, account, isOrganizer]);

  async function handleDecrypt(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError('');
    try {
      const { names: n, title: t } = await decryptEvent(fields, password);
      setNames(n); setTitle(t);
      setStatuses(parseStatuses(fields));
      savePassword(id as string, password);
    } catch { setUnlockError('Wrong password'); }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function execTx(tx: any) {
    tx.setSender(account!.address);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx.setExpiration({ None: true } as any);
    const bytes = await tx.build({ client });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await signAndExecute({ transaction: btoa(String.fromCharCode(...bytes)) as any });
    await refetch();
  }

  function toggleSelect(name: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  async function handleMarkPaypalBatch() {
    const ns = Array.from(selected);
    setTxLoading('batch');
    try {
      await execTx(buildMarkPaypalBatch(id, ns));
      setStatuses(prev => { const n = {...prev}; ns.forEach(x => { n[x] = 2; }); return n; });
      setSelected(new Set());
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(null); }
  }

  async function handleWithdraw() {
    setTxLoading('withdraw');
    try {
      await execTx(buildWithdraw(id));
      alert('Withdrawal successful!');
      setTimeout(() => window.location.reload(), 1500);
    }
    catch (err) { alert(String(err)); }
    finally { setTxLoading(null); }
  }

  async function handleClose() {
    if (!confirm('Close this event?')) return;
    setTxLoading('close');
    try { await execTx(buildCloseEvent(id)); }
    catch (err) { alert(String(err)); }
    finally { setTxLoading(null); }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition";

  if (!account) return (
    <div className="max-w-2xl mx-auto px-6 py-32 text-center text-gray-400">Connect your wallet to access the organizer dashboard.</div>
  );
  if (isLoading) return <div className="max-w-2xl mx-auto px-6 py-32 text-center text-gray-500">Loading…</div>;
  if (!fields) return <div className="max-w-2xl mx-auto px-6 py-32 text-center text-red-400">Event not found</div>;
  if (fields && account && !isOrganizer) return (
    <div className="max-w-lg mx-auto px-6 py-32 text-center">
      <p className="text-4xl mb-4">🔒</p>
      <p className="text-white font-semibold mb-2">Not authorized</p>
      <p className="text-gray-500 text-sm">Your wallet is not the organizer of this event.</p>
      <p className="text-gray-600 text-xs font-mono mt-4 break-all">{account.address}</p>
      {countdown !== null && (
        <p className="text-gray-500 text-sm mt-6">Redirecting to event page in <span className="text-white font-bold">{countdown}</span>s…</p>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href={`/event/${id}`} className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium transition mb-8">← Event Page</Link>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="mb-2 inline-block text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-3 py-1 rounded-full">
            Organizer Dashboard
          </div>
          {title && <h1 className="text-3xl font-bold text-white mt-2 mb-1">{title}</h1>}
          <p className="text-xs font-mono text-gray-500 break-all">{id}</p>
          {!isActive && <span className="mt-1 inline-block text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-full">Closed</span>}
        </div>
        <div className="flex gap-2 shrink-0 ml-4">
          <button onClick={handleWithdraw} disabled={!!txLoading || totalRaisedUsd === 0}
            className="px-4 py-2 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-medium hover:bg-green-500/30 disabled:opacity-40 transition">
            {txLoading === 'withdraw' ? 'Withdrawing…' : `Withdraw $${totalRaisedUsd.toFixed(2)}`}
          </button>
          {isActive && (
            <button onClick={handleClose} disabled={!!txLoading}
              className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 disabled:opacity-40 transition">
              {txLoading === 'close' ? 'Closing…' : 'Close'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[
          { label: 'Goal', value: `$${goalUsd}` },
          { label: 'Raised', value: !isActive && totalRaisedUsd === 0 ? 'Withdrawn' : price ? `$${totalRaisedUsd.toFixed(2)}` : `${poolSui} SUI` },
          { label: 'Paid', value: `${paidCount}/${totalCount}` },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="font-semibold text-sm text-white">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="card p-3 mb-6">
        <p className="text-xs text-gray-500 mb-2">Current pool balance</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xs text-gray-600">SUI</p><p className="text-sm font-semibold text-white">{poolSui}</p></div>
          <div><p className="text-xs text-gray-600">USDC</p><p className="text-sm font-semibold text-white">${poolUsdc}</p></div>
          <div><p className="text-xs text-gray-600">Tips</p><p className="text-sm font-semibold text-white">{tipPoolSui} SUI</p></div>
        </div>
      </div>

      {/* Progress */}
      <div className="card p-4 mb-6">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Progress</span>
          <span>{progress}%{goalUsdCents > 0 ? ` · $${totalRaisedUsd.toFixed(2)} / $${(goalUsdCents/100).toFixed(2)}` : ''}</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Participants — decrypt inline */}
      {!names ? (
        <div className="card p-5">
          <p className="text-sm text-gray-300 font-medium mb-1">Participant list is encrypted</p>
          <p className="text-xs text-gray-500 mb-4">Enter the event password to decrypt and manage participants.</p>
          <form onSubmit={handleDecrypt} className="flex gap-3">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={inputCls} placeholder="Event password" />
            <button type="submit"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-semibold hover:opacity-90 transition whitespace-nowrap">
              Decrypt
            </button>
          </form>
          {unlockError && <p className="text-red-400 text-sm mt-2">{unlockError}</p>}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-yellow-400 text-sm">
              Still pending: {pending.join(', ')}
            </div>
          )}
          {selected.size > 0 && (
            <div className="mb-3 flex items-center justify-between px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-sm text-blue-400">{selected.size} selected</span>
              <button onClick={handleMarkPaypalBatch} disabled={!!txLoading}
                className="text-xs px-4 py-1.5 rounded-full bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-40 transition">
                {txLoading === 'batch' ? 'Marking…' : `Mark ${selected.size} as PayPal ✓`}
              </button>
            </div>
          )}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 w-8" />
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {names.map(name => {
                  const status = resolvedStatuses[name] ?? 0;
                  const s = STATUS[status] ?? { label: `Code ${status}`, cls: 'bg-gray-500/10 text-gray-400 border border-gray-500/20' };
                  const isSelected = selected.has(name);
                  return (
                    <tr key={name}
                      className={`border-b border-white/5 last:border-0 transition ${status === 0 && isActive ? 'cursor-pointer hover:bg-white/5' : ''} ${isSelected ? 'bg-blue-500/10' : ''}`}
                      onClick={() => status === 0 && isActive && toggleSelect(name)}>
                      <td className="px-4 py-3">
                        {status === 0 && isActive && (
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(name)}
                            onClick={e => e.stopPropagation()} className="accent-blue-500 w-4 h-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
