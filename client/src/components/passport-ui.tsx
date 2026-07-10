/*
 * Border Control Terminal · shared motif components
 * MRZ strips, rubber stamps, perforations, section shells, passport card.
 */
import { type ReactNode } from "react";
import {
  type Passport,
  type GateCheck,
  mrzLine,
  isExpired,
} from "@/lib/passport";
import { Check, X, ShieldCheck, Fingerprint } from "lucide-react";

/* ---- MRZ divider strip ---- */
export function MrzStrip({ text }: { text?: string }) {
  const line =
    text ??
    "P<SPASS<<SOVEREIGN<CALIBRATED<ACCOUNTABLE<<<S<OS<SWARM<IDENTITY<LAYER<<<<<<<<<<<<<<<<<<<";
  return (
    <div className="mrz text-[11px] sm:text-xs py-2 border-y border-border/60 select-none" aria-hidden>
      {line.repeat(3)}
    </div>
  );
}

/* ---- Rubber stamp ---- */
export function Stamp({
  children,
  tone = "ink",
  animate = false,
  className = "",
}: {
  children: ReactNode;
  tone?: "ink" | "deny" | "steel";
  animate?: boolean;
  className?: string;
}) {
  const color =
    tone === "ink"
      ? "text-primary"
      : tone === "deny"
        ? "text-[oklch(0.66_0.2_22)]"
        : "text-muted-foreground";
  return (
    <span className={`stamp ${animate ? "stamp-in" : ""} ${color} ${className}`}>
      {children}
    </span>
  );
}

/* ---- Perforation row ---- */
export function Perforation() {
  return <div className="perforation w-full" aria-hidden />;
}

/* ---- Section shell with page-number rail ---- */
export function Section({
  index,
  code,
  title,
  kicker,
  children,
  id,
}: {
  index: string;
  code: string;
  title: string;
  kicker: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <section id={id} className="relative py-20 sm:py-28">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-[140px_1fr] gap-8 lg:gap-12">
          {/* Rail */}
          <div className="lg:sticky lg:top-24 self-start flex lg:flex-col items-baseline lg:items-start gap-3">
            <span className="font-display text-5xl sm:text-6xl font-bold text-primary/90 leading-none tracking-tight">
              {index}
            </span>
            <span className="label-mono">{code}</span>
          </div>
          {/* Content */}
          <div className="min-w-0">
            <div className="ruled mb-10 max-w-3xl relative">
              <p className="label-mono text-primary mb-2.5">{kicker}</p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight uppercase leading-[1.05]">
                {title}
              </h2>
              <span className="slash-watermark -top-4 right-0 text-[7rem] sm:text-[9rem] hidden sm:block" aria-hidden>
                S/
              </span>
            </div>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- Field row for passport card ---- */
function Field({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="label-mono mb-0.5">{label}</div>
      <div className={`${mono ? "font-mono" : "font-display"} text-sm text-foreground truncate`}>
        {value}
      </div>
    </div>
  );
}

/* ---- Status → stamp tone ---- */
export function statusTone(status: Passport["status"]): "ink" | "deny" | "steel" {
  if (status === "active") return "ink";
  if (status === "revoked" || status === "expired") return "deny";
  return "steel";
}

/* ---- The passport card ---- */
export function PassportCard({
  passport,
  animate = false,
  compact = false,
}: {
  passport: Passport;
  animate?: boolean;
  compact?: boolean;
}) {
  const p = passport;
  const expired = isExpired(p);
  const displayStatus = expired && p.status === "active" ? "expired" : p.status;
  return (
    <div className={`panel guilloche doc-corners relative overflow-hidden rounded-sm ${animate ? "rise-in" : ""}`}>
      {/* top band */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border/70 bg-[oklch(0.16_0.033_255.5)/60]">
        <div className="flex items-center gap-2.5">
          <img src="/manus-storage/s-slash-logo_80b146d9.png" alt="S/" className="h-6 w-6 object-contain" />
          <span className="label-mono text-foreground/90">Agent Passport · v0.1</span>
        </div>
        <Stamp tone={statusTone(displayStatus)} animate={animate} className="text-[10px] sm:text-xs">
          {displayStatus}
        </Stamp>
      </div>

      {/* body */}
      <div className="px-4 sm:px-5 py-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="label-mono mb-1">Passport №</div>
            <div className="font-mono text-base sm:text-lg font-semibold text-primary tracking-wider truncate">
              {p.passport_id}
            </div>
          </div>
          <Fingerprint className="h-8 w-8 text-muted-foreground/50 shrink-0" strokeWidth={1.25} />
        </div>

        <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"} gap-x-4 gap-y-3`}>
          <Field label="Agent name" value={p.agent_name} />
          <Field label="Type" value={p.agent_type} />
          <Field label="Calibration" value={p.calibration_level !== null ? `L${p.calibration_level}` : "—"} />
          <Field label="Issued" value={new Date(p.issued_at).toISOString().slice(0, 16).replace("T", " ") + "Z"} />
          <Field
            label="Expires"
            value={p.expires_at ? new Date(p.expires_at).toISOString().slice(0, 16).replace("T", " ") + "Z" : "NEVER"}
          />
          <Field label="Creator" value={p.creator} />
        </div>

        {!compact && (
          <>
            <div className="cutline my-4" />
            <div className="label-mono mb-2">Capabilities · {p.capabilities.length}</div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {p.capabilities.map((c) => (
                <span key={c} className="font-mono text-[11px] px-2 py-0.5 border border-border rounded-[3px] text-secondary-foreground bg-secondary/50">
                  {c}
                </span>
              ))}
              {p.capabilities.length === 0 && <span className="font-mono text-xs text-muted-foreground">none</span>}
            </div>
            <div className="label-mono mb-2">Permissions</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(p.permissions).map(([k, v]) => (
                <span
                  key={k}
                  className={`font-mono text-[11px] px-2 py-0.5 border rounded-[3px] inline-flex items-center gap-1 ${
                    v ? "border-primary/50 text-primary" : "border-border text-muted-foreground line-through decoration-1"
                  }`}
                >
                  {v ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {k}
                </span>
              ))}
              {Object.keys(p.permissions).length === 0 && (
                <span className="font-mono text-xs text-muted-foreground">none</span>
              )}
            </div>
          </>
        )}

        <div className="cutline my-4" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="label-mono">Checksum</span>
            <span className={`font-mono text-xs ${p._tampered ? "text-[oklch(0.66_0.2_22)] line-through" : "text-foreground/80"}`}>
              {p.checksum}
            </span>
          </div>
          {p.signature ? (
            <span className="inline-flex items-center gap-1.5 label-mono text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> ED25519 SIGNED
            </span>
          ) : (
            <span className="label-mono">UNSIGNED</span>
          )}
        </div>
      </div>

      {/* MRZ footer */}
      <div className="mrz text-[10px] px-4 sm:px-5 py-2.5 bg-[oklch(0.15_0.03_255.5)] border-t border-border/70">
        {mrzLine(p)}
      </div>
    </div>
  );
}

/* ---- Gate check list ---- */
export function GateChecklist({ checks, done }: { checks: GateCheck[]; done: boolean }) {
  return (
    <ul className="space-y-1.5">
      {checks.map((c, i) => (
        <li
          key={c.key}
          className="check-in flex items-center gap-2.5 font-mono text-[13px]"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          {c.ok ? (
            <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={3} />
          ) : (
            <X className="h-4 w-4 text-[oklch(0.66_0.2_22)] shrink-0" strokeWidth={3} />
          )}
          <span className={c.ok ? "text-foreground/90" : "text-[oklch(0.66_0.2_22)]"}>{c.label}</span>
          <span className="flex-1 border-b border-dotted border-border/70 mx-1" aria-hidden />
          <span className={`label-mono ${c.ok ? "text-primary" : "text-[oklch(0.66_0.2_22)]"}`}>
            {c.ok ? "OK" : "FAIL"}
          </span>
        </li>
      ))}
      {!done && checks.length === 0 && (
        <li className="font-mono text-xs text-muted-foreground">Awaiting presentation…</li>
      )}
    </ul>
  );
}

/* ---- Code block with syntax-ish highlighting (simple) ---- */
export function CodeBlock({ code, lang = "python" }: { code: string; lang?: string }) {
  return (
    <div className="codeblock relative">
      <div className="flex items-center justify-between px-4 pt-2.5 pb-0">
        <span className="label-mono">{lang}</span>
      </div>
      <pre className="px-4 pb-4 pt-2 overflow-x-auto"><code>{code}</code></pre>
    </div>
  );
}
