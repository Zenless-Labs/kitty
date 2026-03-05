'use client';

import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { encryptNames, hashPassword } from '@/lib/crypto';
import { buildCreateEvent } from '@/lib/contract';
import { useSuiPrice } from '@/lib/useSuiPrice';
import { savePassword } from '@/lib/kitty';

function generatePassword(len = 10): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; // URL-friendly, no ambiguous chars
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

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
  const [password, setPassword] = useState(() => generatePassword());
  const [includePw, setIncludePw] = useState(false);
  const [goalUsd, setGoalUsd] = useState('');
  const [deadline, setDeadline] = useState('');
  const [includeOrganizer, setIncludeOrganizer] = useState(false);
  const [organizerName, setOrganizerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const baseNameList = names.split('\n').map(n => n.trim()).filter(Boolean);
  const nameList = includeOrganizer && organizerName.trim()
    ? [...baseNameList, organizerName.trim()]
    : baseNameList;
  const numParticipants = nameList.length;
  const goalNum = parseFloat(goalUsd) || 0;
  const perPersonUsd = numParticipants > 0 ? goalNum / numParticipants : 0;
  const perPersonSui = usdToSui(perPersonUsd);

  const shareUrl = eventId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/event/${eventId}`
    : '';
  const organizerUrl = eventId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/event/${eventId}/organizer`
    : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nameList.length === 0) { setError('Add at least one participant'); return; }
    if (!password) { setError('Password required'); return; }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx.setExpiration({ None: true } as any);
      const bytes = await tx.build({ client });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await signAndExecute({ transaction: btoa(String.fromCharCode(...bytes)) as any });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created: any[] = (res as any).effects?.created ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eventObj = created.find((o: any) => o.owner?.Shared !== undefined || o.owner === 'Shared');
      const eid = eventObj?.reference?.objectId ?? null;
      if (eid) {
        setEventId(eid);
        savePassword(eid, password);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!account) return (
    <div className="max-w-lg mx-auto px-6 py-32 text-center">
      <p className="text-gray-400">Connect your wallet to create an event.</p>
    </div>
  );

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition";
  const labelCls = "block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider";

  // Show share UI after creation
  if (eventId) return (
    <div className="max-w-lg mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🎉</div>
        <h1 className="text-3xl font-bold text-white mb-2">Event Created!</h1>
        <p className="text-gray-400 text-sm">Share the link below with your participants</p>
      </div>

      <div className="space-y-4">
        {/* Participant link */}
        <div className="card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Participant Link</p>
          <p className="text-xs text-gray-500 mb-3">Send this to everyone — they&apos;ll need the password to unlock</p>
          <div className="flex gap-2">
            <input readOnly value={shareUrl}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none" />
            <button onClick={() => copyToClipboard(shareUrl)}
              className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm hover:bg-blue-500/30 transition whitespace-nowrap">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
            <input type="checkbox" checked={includePw} onChange={e => setIncludePw(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-xs text-gray-400">Include password in link <span className="text-gray-600">(easier on mobile — anyone with the link can open it)</span></span>
          </label>
        </div>

        {/* Organizer dashboard link */}
        <div className="card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Your Dashboard</p>
          <p className="text-xs text-gray-500 mb-3">Bookmark this — your organizer view</p>
          <div className="flex gap-2">
            <input readOnly value={organizerUrl}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none" />
            <button onClick={() => copyToClipboard(organizerUrl)}
              className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 text-sm hover:bg-violet-500/30 transition whitespace-nowrap">
              Copy
            </button>
          </div>
        </div>

        {/* Slack/IM ready message */}
        <div className="card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Ready to paste in Slack / Telegram</p>
          <div className="flex gap-2">
            <textarea readOnly rows={4}
              value={`🐱 *${title || 'Kitty'}* — chip in!\n\nGoal: $${goalNum.toFixed(2)} (${numParticipants} people, $${perPersonUsd.toFixed(2)} each)\n\n👉 ${shareUrl}\n\n🔑 Password: ${password}`}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none resize-none" />
            <button onClick={() => copyToClipboard(`🐱 *${title || 'Kitty'}* — chip in!\n\nGoal: $${goalNum.toFixed(2)} (${numParticipants} people, $${perPersonUsd.toFixed(2)} each)\n\n👉 ${shareUrl}\n\n🔑 Password: ${password}`)}
              className="px-4 py-2 rounded-xl bg-white/10 text-gray-300 border border-white/10 text-sm hover:bg-white/15 transition self-start whitespace-nowrap">
              Copy
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <a href={`/event/${eventId}`}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white text-center font-semibold hover:opacity-90 transition">
            Go to Event →
          </a>
          <button onClick={() => { setEventId(null); setTitle(''); setNames(''); setPassword(generatePassword()); setGoalUsd(''); setDeadline(''); }}
            className="px-6 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:border-white/30 transition">
            New Event
          </button>
        </div>
      </div>
    </div>
  );

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
          {/* Live participant preview */}
          {nameList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {baseNameList.map((name, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-white/8 border border-white/10 text-xs text-gray-300">
                  {name}
                </span>
              ))}
              {includeOrganizer && organizerName.trim() && (
                <span className="px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-xs text-violet-300 font-medium">
                  👑 {organizerName.trim()} (you)
                </span>
              )}
            </div>
          )}
        </div>
        {/* Include organizer checkbox */}
        <div className="flex items-start gap-3">
          <input type="checkbox" id="includeOrganizer" checked={includeOrganizer}
            onChange={e => setIncludeOrganizer(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border border-white/20 bg-white/5 accent-blue-500 cursor-pointer" />
          <div className="flex-1">
            <label htmlFor="includeOrganizer" className="text-sm text-gray-300 cursor-pointer">
              Include me as a participant
            </label>
            <p className="text-xs text-gray-600 mt-0.5">Shows your contribution on the list</p>
            {includeOrganizer && (
              <div className="mt-2">
                <input type="text" value={organizerName} onChange={e => setOrganizerName(e.target.value)}
                  className={inputCls} placeholder="Your name e.g. Alice" required={includeOrganizer} />
                <p className="text-xs text-gray-600 mt-1">This name will be appended to the participant list</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls}>Password</label>
          <div className="flex gap-2">
            <input type="text" value={password} onChange={e => setPassword(e.target.value)}
              className={inputCls} required />
            <button type="button" onClick={() => setPassword(generatePassword())}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm hover:bg-white/10 transition whitespace-nowrap">
              ↻ New
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Auto-generated · URL-safe · 10 chars. Edit if you prefer your own.</p>
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

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold hover:opacity-90 disabled:opacity-40 transition shadow-lg shadow-blue-500/20">
          {loading ? 'Creating…' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}
