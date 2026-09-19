"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bot, FolderKanban, Home as HomeIcon, Landmark, Menu, X } from "lucide-react";

const MORE_LINKS = [
  { href: "/documents", label: "Documents" },
  { href: "/search", label: "Search" },
  { href: "/trust", label: "Trust & verification" },
  { href: "/about", label: "About" },
  { href: "/future", label: "Future implementation" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const isHome = pathname === "/";
  const isBudget = pathname.startsWith("/budget");
  const isAsk = pathname.startsWith("/ask");
  const isProjects = pathname.startsWith("/projects");

  return <>
    <nav className="mobile-tabbar" aria-label="Primary navigation">
      <Link href="/" className={`mobile-tab${isHome ? " active" : ""}`}><HomeIcon size={19} /><small>Home</small></Link>
      <Link href="/budget" className={`mobile-tab${isBudget ? " active" : ""}`}><Landmark size={19} /><small>Explore</small></Link>
      <Link href="/ask" className={`mobile-tab mobile-tab-ask${isAsk ? " active" : ""}`} aria-label="Ask GANI"><span className="mobile-tab-ask-orb"><Bot size={20} /></span><small>Ask GANI</small></Link>
      <Link href="/projects" className={`mobile-tab${isProjects ? " active" : ""}`}><FolderKanban size={19} /><small>Projects</small></Link>
      <button className={`mobile-tab${more ? " active" : ""}`} onClick={() => setMore(true)} aria-haspopup="true"><Menu size={19} /><small>More</small></button>
    </nav>
    {more && <div className="drawer-backdrop" onClick={() => setMore(false)}>
      <aside className="mobile-more-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><div><span className="kicker">More</span><h2>All pages</h2></div><button className="icon-button" onClick={() => setMore(false)}><X /></button></div>
        <div>{MORE_LINKS.map((l) => <Link key={l.href} href={l.href} className="mobile-more-link" onClick={() => setMore(false)}>{l.label}</Link>)}</div>
      </aside>
    </div>}
  </>;
}
