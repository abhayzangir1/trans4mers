import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white font-sans">
      <h1 className="text-6xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
        trans4mers
      </h1>
      <p className="text-xl text-neutral-400 mb-8 max-w-2xl text-center">
        Enterprise Agent Operating System (OS). Collaborative workspace where humans and autonomous AI swarms work together.
      </p>
      
      <Link href="/workspace">
        <button className="bg-white text-neutral-900 px-8 py-3 rounded-full font-bold text-lg hover:bg-neutral-200 transition-colors">
          Enter Debate Board
        </button>
      </Link>
    </div>
  );
}
