import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-32 text-center">
      <div className="inline-block text-5xl mb-6 animate-pulse">⬡</div>
      <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
        Kitty
      </h1>
      <p className="text-gray-400 text-lg mb-12">
        Privacy-preserving team crowdfunding on Sui.<br />
        Encrypted participants. On-chain settlement.
      </p>
      <div className="flex gap-4 justify-center">
        <Link href="/create"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-white font-semibold hover:opacity-90 transition shadow-lg shadow-blue-500/20">
          Create Event
        </Link>
        <a href="#"
          className="px-6 py-3 rounded-xl border border-white/10 text-gray-300 font-semibold hover:border-white/30 hover:text-white transition">
          View Event →
        </a>
      </div>
    </div>
  );
}
