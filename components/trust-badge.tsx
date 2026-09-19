import { AlertTriangle, Bot, ShieldCheck, Users } from "lucide-react";

const KIND_META = {
  verified: { icon: ShieldCheck, label: "Verified public record" },
  "ai-interpretation": { icon: Bot, label: "AI interpretation" },
  community: { icon: Users, label: "Community report — unverified" },
  pending: { icon: AlertTriangle, label: "Pending verification" },
} as const;

export function TrustBadge({ kind }: { kind: keyof typeof KIND_META }) {
  const { icon: Icon, label } = KIND_META[kind];
  return <span className="verified"><Icon size={13} /> {label}</span>;
}
