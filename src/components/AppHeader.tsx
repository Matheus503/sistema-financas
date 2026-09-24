"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export default function AppHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  const headerRef = useRef<HTMLElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const spacer = spacerRef.current;
    if (!header || !spacer) return;
    const resize = () => { spacer.style.height = `${header.getBoundingClientRect().height + 16}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return <>
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-40 border-b border-zinc-700/70 bg-black/75 px-4 pb-4 pt-[max(1.5rem,env(safe-area-inset-top))] text-white shadow-lg shadow-black/30 backdrop-blur-md sm:px-6">
      <div className={`${className} [&_h1]:border-l-4 [&_h1]:border-purple-500 [&_h1]:pl-3`}>{children}</div>
    </header>
    <div ref={spacerRef} aria-hidden="true" className="h-28 shrink-0" />
  </>;
}
