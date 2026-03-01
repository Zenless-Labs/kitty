'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { decryptNames } from '@/lib/crypto';
import { buildContributeSui, buildContributeSuiWithTip, buildMarkPaypal, PACKAGE_ID } from '@/lib/contract';
import { useSuiPrice } from '@/lib/useSuiPrice';

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  1: { label: 'SUI ✓', color: 'bg-green-100 text-green-700' },
  2: { label: 'Paypal ✓', color: 'bg-blue-100 text-blue-700' },
};

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
  const [title, setTitle] = useState<string | null>(null);
  const [names, setNames] = useState<string[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, number>>({});
  const [unlockError, setUnlockError] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [amountSui, setAmountSui] = useState('');
  const [tipSui, setTipSui] = useState('0.01');
  const [txLoading, setTxLoading] = useState(false);

  // Fetch the CrowdFundEvent object from chain
  const { data: objData, isLoading, refetch } = useSuiClientQuery('getObject', {
    id,
    options: { showContent: true },
  });

  const fields = (objData?.data?.content as any)?.fields ?? null;

  // Derived values from on-chain data
  const goalUsdCents: number = fields ? parseInt(fields.goal_usd_cents) : 0;
  const goalUsd = (goalUsdCents / 100).toFixed(2);
  const poolMist: number = fields ? parseInt(fields.pool?.fields?.value ?? fields.pool ?? '0') : 0;
  const poolSui = (poolMist / 1_000_000_000).toFixed(3);
  const isActive: boolean = fields?.active ?? true;
  const deadline: number = fields ? parseInt(fields.deadline) : 0;

  // statuses from VecMap: { keys: [...], values: [...] }
  const onChainStatuses: Record<string, number> = {};
  if (fields?.statuses) {
    const contents: any[] = fields.statuses.fields?.contents ?? [];
    contents.forEach((entry: any) => {
      onChainStatuses[entry.fields.key] = parseInt(entry.fields.value);
    });
  }
  const resolvedStatuses = Object.keys(statuses).length > 0 ? statuses : onChainStatuses;
  const paidCount = Object.values(resolvedStatuses).filter(s => s > 0).length;
  const totalCount = Object.keys(resolvedStatuses).length;

  // Per-person SUI amount based on goal and participant count
  const perPersonUsd = totalCount > 0 ? goalUsdCents / 100 / totalCount : 0;
  const perPersonSui = usdToSui(perPersonUsd);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError('');
    try {
      if (!fields) throw new Error('Event not loaded');
      const encHex: number[] = fields.encrypted_participants;
      // First 16 bytes are the salt (padded), rest is the encrypted blob
      const saltBytes = encHex.slice(0, 16);
      const salt = new TextDecoder().decode(new Uint8Array(saltBytes)).replace(/\0/g, '').replace(/^0+/, '').trim();
      const encData = new TextDecoder().decode(new Uint8Array(encHex.slice(16)));
      const decrypted = await decryptNames(encData, password, salt);

      // Decrypt title
      try {
        const titleHex: number[] = fields.title_encrypted;
        const titleSaltBytes = titleHex.slice(0, 24);
        const titleSaltRaw = new TextDecoder().decode(new Uint8Array(titleSaltBytes)).replace(/\0/g, '').replace(/^0+/, '').trim();
        const titleEncData = new TextDecoder().decode(new Uint8Array(titleHex.slice(24)));
        const titleArr = await decryptNames(titleEncData, password, titleSaltRaw);
        setTitle(titleArr[0] ?? null);
      } catch { setTitle(null); }
      // Sync statuses from on-chain
      setStatuses(onChainStatuses);
      setNames(decrypted);
    } catch {
      setUnlockError('Wrong password or could not decrypt');
    }
  }

  async function execTx(tx: any) {
    tx.setSender(account!.address);
    tx.setExpiration({ None: true } as any);
    const bytes = await tx.build({ client });
    const b64 = btoa(String.fromCharCode(...bytes));
    const res = await signAndExecute({ transaction: b64 as any });
    await refetch();
    return res;
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
      await execTx(tx);
      setStatuses(prev => ({ ...prev, [selectedName]: 1 }));
      setSelectedName('');
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(false); }
  }

  async function handleMarkPaypal() {
    if (!selectedName) return;
    setTxLoading(true);
    try {
      const tx = buildMarkPaypal(id, selectedName);
      await execTx(tx);
      setStatuses(prev => ({ ...prev, [selectedName]: 2 }));
      setSelectedName('');
    } catch (err) { alert(String(err)); }
    finally { setTxLoading(false); }
  }

  if (isLoading) return <div className="max-w-2xl mx-auto px-6 py-24 text-center text-gray-400">Loading event…</div>;
  if (!fields) return <div className="max-w-2xl mx-auto px-6 py-24 text-center text-red-500">Event not found: {id}</div>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-xs text-gray-400 font-mono mb-1">Event</p>
      {title && <h1 className="text-2xl font-bold mb-1">{title}</h1>}
      <p className="text-xs text-gray-400 font-mono mb-2 break-all">{id}</p>
      {!isActive && <span className="inline-block mb-4 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Closed</span>}

      <div className="bg-white border rounded-lg p-4 mb-8 grid grid-cols-4 gap-4 text-center">
        <div><p className="text-xs text-gray-500">Goal</p><p className="font-semibold">${goalUsd}</p></div>
        <div><p className="text-xs text-gray-500">Per person</p>
          <p className="font-semibold">{perPersonSui ? `${perPersonSui.toFixed(2)} SUI` : `$${perPersonUsd.toFixed(2)}`}</p></div>
        <div><p className="text-xs text-gray-500">Pool</p><p className="font-semibold">{poolSui} SUI</p></div>
        <div><p className="text-xs text-gray-500">Paid</p><p className="font-semibold">{paidCount}/{totalCount}</p></div>
      </div>

      {deadline > 0 && (
        <p className="text-sm text-gray-500 mb-6">Deadline: {new Date(deadline).toLocaleDateString()}</p>
      )}

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
                    <tr key={name}
                      className={`border-b last:border-0 hover:bg-gray-50 ${status === 0 && isActive ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (status === 0 && isActive) {
                          setSelectedName(name);
                          if (perPersonSui) setAmountSui(perPersonSui.toFixed(3));
                        }
                      }}>
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[status].color}`}>
                          {STATUS_LABELS[status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {selectedName === name && <span className="text-blue-600 text-xs">selected</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedName && isActive && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="font-semibold mb-1">Contribute as <span className="text-blue-600">{selectedName}</span></h2>
              {perPersonSui && (
                <p className="text-sm text-gray-500 mb-4">
                  Suggested: {perPersonSui.toFixed(3)} SUI ≈ ${perPersonUsd.toFixed(2)}
                  {price && <span className="text-xs text-gray-400 ml-1">(SUI ${price.toFixed(3)})</span>}
                </p>
              )}
              {!account && <p className="text-sm text-gray-500 mb-4">Connect wallet to contribute</p>}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Amount (SUI)</label>
                  <input type="number" step="0.001" min="0" value={amountSui} onChange={e => setAmountSui(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder={perPersonSui?.toFixed(3) ?? '0'} />
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
                  {txLoading ? 'Sending…' : 'Pay with SUI'}
                </button>

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
