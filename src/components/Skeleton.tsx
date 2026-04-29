"use client";

export default function Skeleton() {
  return (
    <div className="bg-zinc-900/70 p-4 rounded-2xl border border-zinc-800 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-1/2 mb-4"></div>

      <div className="space-y-2">
        <div className="h-10 bg-zinc-800 rounded"></div>
        <div className="h-10 bg-zinc-800 rounded"></div>
        <div className="h-10 bg-zinc-800 rounded"></div>
      </div>
    </div>
  );
}