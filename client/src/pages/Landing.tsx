/*
 * S/ Agent Passport — public commercial landing page.
 * Conversion-focused front door: pain hook, benefits, how-it-works, CTA → /portal.
 * Border Control Terminal brand: navy field, copper stamp ink, MRZ dividers.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MrzStrip, Perforation, Stamp } from "@/components/passport-ui";
import {
  ArrowRight,
  KeyRound,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Stamp as StampIcon,
  Vault,
  Wrench,
  FileDown,
  Eye,
} from "lucide-react";

const HERO_BG = "/manus-storage/hero-checkpoint_653f00d7.png";
const BOOKLET_IMG = "/manus-storage/passport-booklet_d06db170.png";
const LOGO = "/manus-storage/s-slash-logo_80b146d9.png";

const PAINS = [
  {
    icon: KeyRound,
    title: "Keys pasted everywhere",
    body: "Your OpenAI key lives in six config files, two notebooks, and a sticky note. Every new agent means another copy.",
  },
  {
    icon: Eye,
    title: "Zero visibility",
    body: "Which agent can touch your database? Which one can deploy? Right now the honest answer is: you don't know.",
  },
  {
    icon: RefreshCcw,
    title: "No kill switch",
    body: "An agent goes rogue or a key leaks — and you're grepping through repos at 2 AM rotating everything it ever touched.",
  },
];

const BENEFITS = [
  {
    icon: Vault,
    title: "One sealed vault",
    body: "Add each secret key once. It's encrypted at rest and never printed in any document — agents receive it as an environment variable at runtime.",
  },
  {
    icon: Wrench,
    title: "Tools on request",
    body: "Pick exactly the tools your agent needs from a scoped catalog. Sensitive tools carry permission flags with extra scrutiny.",
  },
  {
    icon: StampIcon,
    title: "A real approval gate",
    body: "Every application lands at the approval desk. A human stamps APPROVED or DENIED before any credential exists.",
  },
  {
    icon: FileDown,
    title: "Two documents, one identity",
    body: "Download the full owner dossier as a PDF, and an embed bundle that drops straight into your agent's code.",
  },
  {
    icon: ShieldCheck,
    title: "Verifiable, revocable",
    body: "Checksummed identity core, issuer signature, TTL expiry, and one-click revocation that every gate respects instantly.",
  },
  {
    icon: Lock,
    title: "Least privilege by default",
    body: "Agents can never hold more than you granted. Spawned children inherit less — never more.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Seal your keys",
    body: "Open your owner file and add secret keys to your private vault — once, and never again.",
  },
  {
    n: "02",
    title: "Request a passport",
    body: "Name your agent, pick its tools, grant vault keys by name, set a TTL, and submit the application.",
  },
  {
    n: "03",
    title: "Clear the gate",
    body: "The approval desk inspects your application and stamps it. Approved passports are minted, signed, and ready to download.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ================= NAV ================= */}
      <header className="fixed top-0 inset-x-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="container flex items-center justify-between h-14">
          <a href="#" className="flex items-center gap-2.5">
            <img src={LOGO} alt="S/" className="h-7 w-7 object-contain" />
            <span className="font-display font-bold tracking-tight">Agent Passport</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 label-mono">
            <a href="#pain" className="hover:text-primary transition-colors">Why</a>
            <a href="#how" className="hover:text-primary transition-colors">How it works</a>
            <a href="#benefits" className="hover:text-primary transition-colors">What you get</a>
            <Link href="/demo" className="hover:text-primary transition-colors">Live demo</Link>
          </nav>
          <Link href="/portal">
            <Button size="sm" className="btn-press font-mono text-xs tracking-wider uppercase rounded-[3px]">
              <StampIcon className="h-3.5 w-3.5 mr-1.5" /> Issue a passport
            </Button>
          </Link>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section className="relative min-h-[94vh] flex items-center overflow-hidden pt-14">
        <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/40 to-transparent" />
        <span className="slash-watermark top-10 -right-14 text-[24rem] lg:text-[32rem] hidden md:block z-[5]" aria-hidden>
          S/
        </span>

        <div className="container relative z-10 py-20">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-7 rise-in">
              <img src={LOGO} alt="S/" className="h-10 w-10 object-contain" />
              <span className="label-mono text-primary">One credential · every agent · zero pasted keys</span>
            </div>
            <h1
              className="font-display text-4xl sm:text-6xl lg:text-[4.4rem] font-bold tracking-tight uppercase leading-[1.04] mb-6 rise-in"
              style={{ animationDelay: "60ms" }}
            >
              Tired of pasting your
              <br />
              API keys <span className="text-primary">over and over</span>?
            </h1>
            <p
              className="font-mono text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed mb-8 rise-in"
              style={{ animationDelay: "120ms" }}
            >
              Seal your secrets once. Issue each agent a signed, scoped, revocable
              passport instead. Your keys stay in the vault — your agents carry
              papers, not passwords.
            </p>
            <div className="flex flex-wrap items-center gap-4 mb-10 rise-in" style={{ animationDelay: "180ms" }}>
              <Link href="/portal">
                <Button size="lg" className="btn-press font-mono tracking-widest uppercase text-xs rounded-[3px] h-12 px-7">
                  Issue your first passport <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="btn-press font-mono tracking-widest uppercase text-xs rounded-[3px] h-12 px-6 border-primary/50 text-primary hover:bg-primary/10"
                >
                  Watch the gate inspect
                </Button>
              </Link>
            </div>
            <div className="rise-in" style={{ animationDelay: "240ms" }}>
              <Stamp tone="ink" className="text-sm sm:text-base">No passport · no tools · no exceptions</Stamp>
            </div>
          </div>
        </div>
      </section>

      <MrzStrip text="P<SPASS<<SEAL<ONCE<<<ISSUE<SCOPED<<<REVOKE<INSTANTLY<<<YOUR<KEYS<NEVER<LEAVE<THE<VAULT<<<" />

      {/* ================= PAIN ================= */}
      <section id="pain" className="py-20 sm:py-28">
        <div className="container">
          <div className="max-w-2xl mb-12">
            <span className="label-mono text-primary">The problem</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight uppercase mt-3">
              Secret sprawl is how agents get you burned.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {PAINS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="panel doc-corners rounded-sm p-6 rise-in" style={{ animationDelay: `${i * 80}ms` }}>
                <Icon className="h-6 w-6 text-primary mb-4" strokeWidth={1.5} />
                <div className="font-display font-semibold text-lg mb-2">{title}</div>
                <p className="font-mono text-[13px] text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Perforation />

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="py-20 sm:py-28">
        <div className="container">
          <div className="grid lg:grid-cols-[1fr_360px] gap-12 items-center">
            <div>
              <span className="label-mono text-primary">How it works</span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight uppercase mt-3 mb-10">
                Three steps. One credential.
              </h2>
              <div className="space-y-6">
                {STEPS.map((s, i) => (
                  <div key={s.n} className="flex gap-6 rise-in" style={{ animationDelay: `${i * 90}ms` }}>
                    <div className="font-display text-4xl sm:text-5xl font-bold text-primary/80 leading-none w-16 shrink-0">
                      {s.n}
                    </div>
                    <div className="pt-1">
                      <div className="font-display font-semibold text-lg mb-1.5">{s.title}</div>
                      <p className="font-mono text-[13px] text-muted-foreground leading-relaxed max-w-lg">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-10">
                <Link href="/portal">
                  <Button size="lg" className="btn-press font-mono tracking-widest uppercase text-xs rounded-[3px] h-11 px-6">
                    Open the portal <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
            <img
              src={BOOKLET_IMG}
              alt="S/ Agent Passport booklet"
              className="w-full rounded-sm border border-border/60 hidden lg:block"
            />
          </div>
        </div>
      </section>

      <MrzStrip text="P<SPASS<<VAULT<SEALED<<<TOOLS<SCOPED<<<GATE<STAMPED<<<PASSPORT<MINTED<SIGNED<REVOCABLE<<<" />

      {/* ================= BENEFITS ================= */}
      <section id="benefits" className="py-20 sm:py-28">
        <div className="container">
          <div className="max-w-2xl mb-12">
            <span className="label-mono text-primary">What you get</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight uppercase mt-3">
              Everything your agents need. Nothing they shouldn't have.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="panel rounded-sm p-6 rise-in" style={{ animationDelay: `${i * 60}ms` }}>
                <Icon className="h-5 w-5 text-primary mb-3.5" strokeWidth={1.5} />
                <div className="font-display font-semibold mb-1.5">{title}</div>
                <p className="font-mono text-[12.5px] text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Perforation />

      {/* ================= FINAL CTA ================= */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <span className="slash-watermark -bottom-24 -left-16 text-[20rem] hidden md:block" aria-hidden>
          S/
        </span>
        <div className="container relative z-10 text-center">
          <Stamp tone="ink" className="text-base sm:text-lg mb-8 inline-block">Approval desk is open</Stamp>
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight uppercase mb-6 max-w-3xl mx-auto">
            Give your agents papers.
            <br />
            Keep your keys<span className="text-primary">.</span>
          </h2>
          <p className="font-mono text-sm text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Open your owner file, seal your first secret, and submit a passport
            application. Approval takes one stamp.
          </p>
          <Link href="/portal">
            <Button size="lg" className="btn-press font-mono tracking-widest uppercase text-xs rounded-[3px] h-12 px-8">
              <StampIcon className="h-4 w-4 mr-2" /> Issue your first passport
            </Button>
          </Link>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-border/60">
        <MrzStrip text="P<SPASS<<SOVEREIGN<CALIBRATED<ACCOUNTABLE<<<AGENT<IDENTITY<INFRASTRUCTURE<<<<<<<<<<<<<<<<" />
        <div className="container py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="S/" className="h-9 w-9 object-contain" />
            <div>
              <div className="font-display font-bold">S/ Agent Passport</div>
              <div className="label-mono">Sovereign · Calibrated · Accountable</div>
            </div>
          </div>
          <div className="flex items-center gap-6 label-mono">
            <Link href="/demo" className="hover:text-primary transition-colors">Live demo</Link>
            <Link href="/portal" className="hover:text-primary transition-colors">Portal</Link>
            <Link href="/admin" className="hover:text-primary transition-colors">Approval desk</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
