import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Team Crowdfunding on Sui</h1>
      <p className="text-lg text-gray-600 mb-2">
        Collect contributions from your team — privately.
      </p>
      <p className="text-gray-500 mb-10">
        Organizers create a password-protected event with a participant list.
        Contributors pay with SUI or mark as paid via Paypal.
        Only people with the password can see who&apos;s contributed.
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/create"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Create Event
        </Link>
        <a
          href="#"
          className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition"
        >
          View Event by ID
        </a>
      </div>
    </div>
  );
}
