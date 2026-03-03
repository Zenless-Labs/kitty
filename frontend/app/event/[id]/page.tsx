'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { buildContributeSui, buildContributeSuiWithTip, buildContributeCoin, USDC_TYPE } from '@/lib/contract';
import { useSuiPrice } from '@/lib/useSuiPrice';
import { decryptEvent, parseStatuses, savePassword, loadPassword } from '@/lib/kitty';

const STATUS = {
  0: { label: 'Pending',   cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  1: { label: 'SUI ✓',    cls: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  2: { label: 'PayPal ✓', cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  3: { label: 'USDC ✓',   cls: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' },
} as Record<number, {label:string;cls:string}>;

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { price, usdToSui } = useSuiPrice();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      client.executeTransactionBlock({ transactionBlock: bytes, signature, options: { showEffects: true } }),
  });

  const [password, setPassword] = useState('');
  const [names, setNames] = useState<string[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, number>>({});
  const [unlockError, setUnlockError] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [amountSui, setAmountSui] = useState('');
  const [tipOption, setTipOption] = useState<'default'|'custom'|'none'>('default');
  const [tipSui, setTipSui] = useState('0.01');
  const [txLoading, setTxLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'sui'|'usdc'>('sui');

  const { data: objData, isLoading, refetch } = useSuiClientQuery('getObject', {
    id, options: { showContent: true },
  });

  const fields = (objData?.data?.content as any)?.fields ?? null;
  const isOrganizer = account?.address === fields?.organizer;

  // Auto-decrypt from URL param or localStorage on load
  useEffect(() => {
    if (!fields || names !== null) return;
    const pw = loadPassword(id);
    if (!pw) return;
    setPassword(pw);
    decryptEvent(fields, pw).then(({ names: n, title: t }) => {
      setNames(n);
      setTitle(t);
      setStatuses(parseStatuses(fields));
    }).catch(() => {});
  }, [fields]);

  const goalUsdCents: number = fields ? parseInt(fields.goal_usd_cents) : 0;
  const goalUsd = (goalUsdCents / 100).toFixed(2);
  const poolMist: number = fields ? parseInt(fields.pool_sui?.fields?.value ?? fields.pool_sui ?? '0') : 0;
  const poolSui = (poolMist / 1e9).toFixed(3);
  const poolUsdcRaw: number = fields ? parseInt(fields.pool_usdc?.fields?.value ?? fields.pool_usdc ?? '0') : 0;
  const poolUsdc = (poolUsdcRaw / 1e6).toFixed(2);
  const isActive: boolean = fields?.active ?? true;
  const deadline: number = fields ? parseInt(fields.deadline) : 0;
  const onChainStatuses = parseStatuses(fields);
  const resolvedStatuses = Object.keys(statuses).length > 0 ? statuses : onChainStatuses;
  const paidCount = Object.values(resolvedStatuses).filter(s => s > 0).length;
  const totalCount = names?.length ?? Object.keys(resolvedStatuses).length;
  const perPersonUsd = totalCount > 0 ? goalUsdCents / 100 / totalCount : 0;
  const perPersonSui = usdToSui(perPersonUsd);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError('');
    try {
      const { names: n, title: t } = await decryptEvent(fields, password);
      setNames(n); setTitle(t);
      setStatuses(parseStatuses(fields));
      savePassword(id, password);
    } catch { setUnlockError('Wrong password'); }
  }

  async function execTx(tx: any) {
    tx.setSender(account!.address);
    tx.setExpiration({ None: true } as any);
    const bytes = await tx.build({ client });
    await signAndExecute({ transaction: btoa(String.fromCharCode(...bytes)) as any });
    await refetch();
  }

  async function handleContribute() {
    if (!selectedName || !amountSui) return;
    setTxLoading(true);
    try {
      if (paymentMethod === 'usdc') {
        // Fetch user's USDC coins
        const coins = await client.getCoins({ owner: account!.address, coinType: USDC_TYPE });
        if (!coins.data.length) throw new Error('No USDC coins found in your wallet');
        const usdcCoinId = coins.data[0].coinObjectId;
        const amountUnits = BigInt(Math.round(parseFloat(amountSui) * 1e6));
        const tipMist = tipOption !== 'none' && parseFloat(tipSui) > 0
          ? BigInt(Math.round(parseFloat(tipSui) * 1e9)) : 0n;
        // USDC contribution + optional SUI tip as separate txs
        const tx = buildContributeCoin({ eventId: id, name: selectedName, amountUnits, coinObjectId: usdcCoinId });
        await execTx(tx);
        if (tipMist > 0n) {
          // Send tip separately as SUI transfer to organizer
          const { Transaction } = await import('@mysten/sui/transactions');
          const tipTx = new Transaction();
          const [tipCoin] = tipTx.splitCoins(tipTx.gas, [tipMist]);
          tipTx.transferObjects([tipCoin], fields.organizer);
          await execTx(tipTx);
        }
        setStatuses(prev => ({ ...prev, [selectedName]: 3 }));
      } else {
        const amountMist = BigInt(Math.round(parseFloat(amountSui) * 1e9));
        const tipMist = tipOption !== 'none' && parseFloat(tipSui) > 0
          ? BigInt(Math.round(parseFloat(tipSui) * 1e9)) : 0n;
        const tx = tipMist > 0n
          ? buildContributeSuiWithTip({ eventId: id, name: selectedName, amountMist, tipMist })
          : buildContributeSui({ eventId: id, name: selectedName, amountMist });
        await execTx(tx);
        setStatuses(prev => ({ ...prev, [selectedName]: 1 }));
      }
      setSelectedName('');
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(false); }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition";

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-6 py-32 text-center text-gray-500">Loading…</div>
  );
  if (!fields) return <div className="max-w-2xl mx-auto px-6 py-32 text-center text-red-400">Event not found</div>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {title
        ? <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">{title}</h1>
        : <h1 className="text-3xl font-bold mb-1 text-gray-200">Event</h1>}
      <p className="text-xs font-mono text-gray-500 mb-2 break-all">{id}</p>
      {isOrganizer && (
        <a href={`/event/${id}/organizer`}
          className="inline-flex items-center gap-2 mt-3 mb-1 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 text-sm font-medium hover:bg-violet-500/20 transition">
          <span>⚙️</span> You're the organizer — go to Dashboard →
        </a>
      )}
      {!isActive && <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-full">Closed</span>}

      <div className="grid grid-cols-5 gap-3 my-6">
        {[
          { label: 'Goal', value: `$${goalUsd}` },
          { label: 'Per person', value: perPersonSui ? `${perPersonSui.toFixed(2)} SUI` : `$${perPersonUsd.toFixed(2)}` },
          { label: 'SUI Pool', value: `${poolSui} SUI` },
          { label: 'USDC Pool', value: `$${poolUsdc}` },
          { label: 'Paid', value: `${paidCount}/${totalCount}` },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="font-semibold text-sm text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {deadline > 0 && <p className="text-sm text-gray-500 mb-6">Deadline: {new Date(deadline).toLocaleDateString()}</p>}

      {!names ? (
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Enter password to view participants</h2>
          <form onSubmit={handleUnlock} className="space-y-3">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={inputCls} placeholder="Event password" />
            {unlockError && <p className="text-red-400 text-sm">{unlockError}</p>}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold hover:opacity-90 transition">
              Unlock
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-3">
            👇 Pick your name from the list to chip in — or pay on someone else&apos;s behalf 🙂
          </p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {names.map(name => {
                  const status = resolvedStatuses[name] ?? 0;
                  const s = STATUS[status];
                  return (
                    <tr key={name}
                      className={`border-b border-white/5 last:border-0 transition ${status === 0 && isActive ? 'cursor-pointer hover:bg-white/5' : ''} ${selectedName === name ? 'bg-blue-500/10' : ''}`}
                      onClick={() => { if (status === 0 && isActive) { setSelectedName(name); if (perPersonSui) setAmountSui(perPersonSui.toFixed(3)); } }}>
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

          {selectedName && isActive && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-1">Contributing as <span className="text-blue-400">{selectedName}</span></h2>
              {perPersonSui && price && paymentMethod === 'sui' && (
                <p className="text-sm text-gray-500 mb-4">Suggested {perPersonSui.toFixed(3)} SUI ≈ ${perPersonUsd.toFixed(2)} · SUI ${price.toFixed(3)}</p>
              )}
              {perPersonUsd > 0 && paymentMethod === 'usdc' && (
                <p className="text-sm text-gray-500 mb-4">Suggested ${perPersonUsd.toFixed(2)} USDC</p>
              )}

              {/* Payment method toggle */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => setPaymentMethod('sui')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${paymentMethod==='sui' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}>
                  SUI
                </button>
                <button onClick={() => setPaymentMethod('usdc')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${paymentMethod==='usdc' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}>
                  USDC
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Amount ({paymentMethod === 'usdc' ? 'USDC' : 'SUI'})
                  </label>
                  <input type="number"
                    step={paymentMethod === 'usdc' ? '0.01' : '0.001'}
                    min="0"
                    value={amountSui}
                    onChange={e => setAmountSui(e.target.value)}
                    className={inputCls}
                    placeholder={paymentMethod === 'usdc' ? perPersonUsd.toFixed(2) : (perPersonSui?.toFixed(3) ?? '0')} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Tip for organizer (SUI)</label>
                  <div className="flex gap-2 mb-2">
                    {(['default', 'custom', 'none'] as const).map(opt => (
                      <button key={opt} type="button"
                        onClick={() => { setTipOption(opt); if (opt === 'default') setTipSui('0.01'); if (opt === 'none') setTipSui('0'); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${tipOption === opt ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}>
                        {opt === 'default' ? '0.01 SUI' : opt === 'custom' ? 'Custom' : 'No tip'}
                      </button>
                    ))}
                  </div>
                  {tipOption === 'custom' && (
                    <input type="number" step="0.01" min="0" value={tipSui} onChange={e => setTipSui(e.target.value)}
                      className={inputCls} placeholder="Amount in SUI" />
                  )}
                </div>
              </div>

              {!account && <p className="text-sm text-gray-500 mb-3 text-center">Connect wallet to pay</p>}
              <button onClick={handleContribute} disabled={txLoading || !account}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold hover:opacity-90 disabled:opacity-40 transition">
                {txLoading ? 'Sending…' : `Pay with ${paymentMethod === 'usdc' ? 'USDC' : 'SUI'}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
