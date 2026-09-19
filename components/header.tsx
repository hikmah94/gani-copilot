"use client";

import Link from "next/link";
import { Menu, MessageCircle, Search, X } from "lucide-react";
import { useState } from "react";
import { MobileNav } from "@/components/mobile-nav";

export function Header() {
  const [open, setOpen] = useState(false);
  return <>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="GANI home"><span className="brand-mark">G</span><span>GANI<small>Public intelligence</small></span></Link>
      <nav className={open ? "nav open" : "nav"} aria-label="Primary navigation">
        <Link href="/">Home</Link><Link href="/budget">Explore budget</Link><Link href="/projects">Projects</Link><Link href="/documents">Documents</Link><Link href="/about">About</Link><Link href="/future">Future</Link>
      </nav>
      <Link href="/search" aria-label="Search" className="header-search" style={{color:"var(--muted)"}}><Search size={18}/></Link>
      <Link className="button header-ask" href="/ask"><MessageCircle size={17}/> Ask GANI</Link>
      <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X/> : <Menu/>}</button>
    </header>
    <MobileNav/>
  </>;
}
