import Link from "next/link";

export function Footer() {
  return <footer><div><span className="footer-logo">GANI</span><p>Turning public records into public understanding.</p></div><div className="footer-links"><Link href="/about">How it works</Link><Link href="/trust">Trust &amp; verification</Link><Link href="/documents">Sources</Link><Link href="/future">Future implementation</Link><span>Built for Niger State</span></div><p className="fineprint">Source-backed public budget intelligence · © 2026 GANI</p></footer>;
}
