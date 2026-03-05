'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useSuiPrice } from '@/lib/useSuiPrice';
import { PACKAGE_ID } from '@/lib/contract';

const ALL_PACKAGE_IDS = [
  PACKAGE_ID,
  '0xdde343b4f166b80ebf885107af3e726340a57ceb5d47ccc331c11a7c65dbfb11', // v3
  '0x0b0afb87c57d53ee79aee3252da9379b1025be9f517ca4f4e338ba2f1a7d6b85', // v2
  '0x43f567db67ef8f0d2c84a470277bbff3c46c36393fe32d5325d70169b5b7f820', // v1
];

interface KittyEvent {
  event_id: string;
  goal_usd_cents: number;
  deadline: number;
  createdAt: number;
  txDigest: string;
  poolSuiMist?: number;
  poolUsdcRaw?: number;
  isOpen?: boolean;
}

export default function Home() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [events, setEvents] = useState<KittyEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventId, setEventId] = useState('');
  const { price: suiPrice } = useSuiPrice();

  useEffect(() => {
    if (account) loadMyEvents();
    else setEvents(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  async function loadMyEvents() {
    if (!account) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allResults = await Promise.all(ALL_PACKAGE_IDS.map(pkgId =>
        (client as any).queryEvents({ query: { MoveEventType: `${pkgId}::kitty::KittyEventCreated` }, limit: 50 })
      ));
      const seen = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allEvents = allResults.flatMap((r: any) => r.data ?? []).filter((e: any) => {
        const id = e.parsedJson?.event_id;
        if (!id || seen.has(id)) return false;
        seen.add(id); return true;
      });
      const base = allEvents
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((e: any) => e.parsedJson?.organizer === account.address)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => ({
          event_id: e.parsedJson.event_id,
          goal_usd_cents: parseInt(e.parsedJson.goal_usd_cents),
          deadline: parseInt(e.parsedJson.deadline),
          createdAt: parseInt(e.timestampMs ?? '0'),
          txDigest: e.id?.txDigest ?? '',
        }));

      // Fetch pool balances for each event
      const mine = await Promise.all(base.map(async (ev: KittyEvent) => {
        try {
          const obj = await client.getObject({ id: ev.event_id, options: { showContent: true } });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fields = (obj.data?.content as any)?.fields ?? {};
          const poolSuiMist = parseInt(fields.pool_sui?.fields?.value ?? fields.pool_sui ?? '0');
          const poolUsdcRaw = parseInt(fields.pool_coin?.fields?.value ?? fields.pool_coin ?? '0');
          const isOpen = fields.active ?? true;
          return { ...ev, poolSuiMist, poolUsdcRaw, isOpen };
        } catch { return ev; }
      }));
      setEvents(mine);
    } catch (err) {
      console.error(err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <img src="/logo.jpg" alt="Kitty" className="w-24 h-24 rounded-2xl object-cover mx-auto mb-4 shadow-lg shadow-violet-500/20" />
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
          Kitty
        </h1>
        <p className="text-gray-400 text-lg mb-10">
          Chip in together. Privately. On Sui.<br />
          <span className="text-sm text-gray-600">Encrypted participants. On-chain settlement.</span>
        </p>
        <Link href="/create"
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold hover:opacity-90 transition shadow-lg shadow-blue-500/20">
          Create Event
        </Link>
      </div>

      {/* Enter event ID */}
      <div className="card p-5 mb-6">
        <p className="text-sm text-gray-400 mb-3 font-medium">Go to an event</p>
        <div className="flex gap-3">
          <input value={eventId} onChange={e => setEventId(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition"
            placeholder="0x event object ID…" />
          <Link href={eventId ? `/event/${eventId.trim()}` : '#'}
            className="px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition">
            Go →
          </Link>
        </div>
      </div>

      {/* My events (wallet connected) */}
      {account && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-300">My Events</p>
<button onClick={loadMyEvents} disabled={loading}
              className="text-xs text-blue-400 hover:text-blue-300 transition disabled:opacity-40">
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>
          {events === null && loading && (
            <p className="text-xs text-gray-600 text-center py-4">Loading…</p>
          )}
          {events?.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">No events found for this wallet</p>
          )}
          {events && events.length > 0 && (
            <div className="space-y-2">
              {events.map(ev => (
                <Link key={ev.event_id} href={`/event/${ev.event_id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/8 transition group">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-gray-400 group-hover:text-gray-300 transition">
                      {ev.event_id.slice(0, 10)}…{ev.event_id.slice(-6)}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                        Created {new Date(ev.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                        {ev.deadline > 0 && ` · Due ${new Date(ev.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`}
                      </p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-sm font-semibold text-white">Goal: ${(ev.goal_usd_cents / 100).toFixed(2)}</p>
                    {(() => {
                      const suiUsd = suiPrice && ev.poolSuiMist ? (ev.poolSuiMist / 1e9) * suiPrice : 0;
                      const usdcUsd = ev.poolUsdcRaw ? ev.poolUsdcRaw / 1e6 : 0;
                      const total = suiUsd + usdcUsd;
                      if (!ev.isOpen && total === 0) return <p className="text-xs text-orange-400 mt-0.5">Closed · Withdrawn</p>;
                      if (!ev.isOpen) return <p className="text-xs text-orange-400 mt-0.5">Closed · In Pool: ${total.toFixed(2)}</p>;
                      return total > 0
                        ? <p className="text-xs text-green-400 mt-0.5">In Pool: ${total.toFixed(2)}</p>
                        : <p className="text-xs text-gray-600 mt-0.5">Nothing raised yet</p>;
                    })()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
