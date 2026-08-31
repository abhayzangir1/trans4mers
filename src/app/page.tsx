import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white font-sans">
      <h1 className="mb-4">
        <img src="/trans4mers-logo.png" alt="trans4mers" className="h-24 w-auto object-contain drop-shadow-lg" />
      </h1>
      <p className="text-xl text-neutral-400 mb-8 max-w-2xl text-center">
        Trans4mers. Collaborative workspace where humans and autonomous AI swarms work together.
      </p>
      
      <Link href="/workspace">
        <button className="bg-white text-neutral-900 px-8 py-3 rounded-full font-bold text-lg hover:bg-neutral-200 transition-colors">
          Enter
        </button>
      </Link>
    </div>
  );
}
