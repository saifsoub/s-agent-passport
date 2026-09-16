import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { BrainCircuit, ChevronLeft, Clock3, FileWarning, ShieldAlert, ShieldCheck } from "lucide-react";

type TrainingStatus = "complete" | "due" | "overdue";
type ItemStatus = "pass" | "missing" | "failed";
type EvidenceStatus = "verified" | "missing";

export type AgentProfile = {
  id: string;
  name: string;
  role: "Agent" | "Worker" | "Outsource";
  activePassportId: string;
  trainingStatus: TrainingStatus;
  passportExpiry: string;
  mandatoryChecks: { label: string; status: ItemStatus }[];
  evidenceUploads: { label: string; status: EvidenceStatus }[];
  complianceHistory: { month: string; misses: number; lateRefreshers: number };
};

export type AiInsight = {
  profileId: string;
  expiryDays: number;
  riskScore: number;
  riskFlags: string[];
  predictedExpiryRisk: string;
  recommendation: string;
};

const DAY_MS = 1000 * 60 * 60 * 24;

const AGENT_PROFILES: AgentProfile[] = [
  {
    id: "a-101",
    name: "Khalid Mansoor",
    role: "Agent",
    activePassportId: "S-PASS-3F8C7A2B1D9E",
    trainingStatus: "complete",
    passportExpiry: "2026-10-02",
    mandatoryChecks: [
      { label: "ID verification", status: "pass" },
      { label: "Safety induction", status: "pass" },
      { label: "Medical fitness", status: "pass" },
    ],
    evidenceUploads: [
      { label: "Signed induction form", status: "verified" },
      { label: "Medical certificate", status: "verified" },
    ],
    complianceHistory: { month: "Aug", misses: 0, lateRefreshers: 0 },
  },
  {
    id: "w-240",
    name: "Ravi Sharma",
    role: "Worker",
    activePassportId: "S-PASS-9C0E4F1A8B5D",
    trainingStatus: "due",
    passportExpiry: "2026-09-21",
    mandatoryChecks: [
      { label: "ID verification", status: "pass" },
      { label: "Safety induction", status: "failed" },
      { label: "Medical fitness", status: "pass" },
    ],
    evidenceUploads: [
      { label: "Signed induction form", status: "missing" },
      { label: "Medical certificate", status: "verified" },
    ],
    complianceHistory: { month: "Aug", misses: 2, lateRefreshers: 1 },
  },
  {
    id: "o-067",
    name: "Amal Technical Services",
    role: "Outsource",
    activePassportId: "S-PASS-D2A7C4E19F30",
    trainingStatus: "overdue",
    passportExpiry: "2026-09-18",
    mandatoryChecks: [
      { label: "ID verification", status: "pass" },
      { label: "Safety induction", status: "missing" },
      { label: "Medical fitness", status: "failed" },
    ],
    evidenceUploads: [
      { label: "Signed induction form", status: "missing" },
      { label: "Medical certificate", status: "missing" },
    ],
    complianceHistory: { month: "Aug", misses: 3, lateRefreshers: 2 },
  },
  {
    id: "w-155",
    name: "Fatima Noor",
    role: "Worker",
    activePassportId: "S-PASS-77E1A5C8D4B2",
    trainingStatus: "complete",
    passportExpiry: "2026-11-30",
    mandatoryChecks: [
      { label: "ID verification", status: "pass" },
      { label: "Safety induction", status: "pass" },
      { label: "Medical fitness", status: "pass" },
    ],
    evidenceUploads: [
      { label: "Signed induction form", status: "verified" },
      { label: "Medical certificate", status: "verified" },
    ],
    complianceHistory: { month: "Aug", misses: 0, lateRefreshers: 0 },
  },
];

export function daysToExpiry(date: string, nowTs = Date.now()) {
  const [year, month, day] = date.split("-").map(Number);
  const expiryStamp = Date.UTC(year, month - 1, day);
  const now = new Date(nowTs);
  const todayStamp = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((expiryStamp - todayStamp) / DAY_MS);
}

function trainingBadge(status: TrainingStatus) {
  if (status === "complete") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (status === "due") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-red-500/20 text-red-300 border-red-500/40";
}

function expiryBadge(days: number) {
  if (days <= 14) return "bg-red-500/20 text-red-300 border-red-500/40";
  if (days <= 30) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
}

export function buildInsight(profile: AgentProfile, nowTs = Date.now()): AiInsight {
  const expiryDays = daysToExpiry(profile.passportExpiry, nowTs);
  const failedChecks = profile.mandatoryChecks.filter((check) => check.status === "failed").length;
  const missingChecks = profile.mandatoryChecks.filter((check) => check.status === "missing").length;
  const missingEvidence = profile.evidenceUploads.filter((item) => item.status === "missing").length;

  let riskScore = 0;
  if (expiryDays <= 14) riskScore += 35;
  else if (expiryDays <= 30) riskScore += 20;
  if (profile.trainingStatus === "due") riskScore += 20;
  if (profile.trainingStatus === "overdue") riskScore += 35;
  riskScore += failedChecks * 12 + missingChecks * 10 + missingEvidence * 8;
  riskScore += profile.complianceHistory.misses * 5 + profile.complianceHistory.lateRefreshers * 4;

  const riskFlags: string[] = [];
  if (profile.trainingStatus !== "complete") riskFlags.push("Training attention required");
  if (expiryDays <= 30) riskFlags.push("Passport nearing expiry");
  if (failedChecks > 0 || missingChecks > 0) riskFlags.push("Mandatory checks incomplete");
  if (missingEvidence > 0) riskFlags.push("Evidence uploads missing");
  if (profile.complianceHistory.misses >= 2) riskFlags.push("Pattern: repeated compliance misses");

  const predictedExpiryRisk =
    expiryDays <= 14
      ? "Critical renewal window"
      : expiryDays <= 30
        ? "High renewal pressure"
        : expiryDays <= 45
          ? "Monitor renewal queue"
          : "Low expiry pressure";

  const recommendation =
    riskScore >= 90
      ? "Verify immediately before site entry."
      : riskScore >= 65
        ? "Prioritize in today's verification queue."
        : "Keep in routine audit cycle.";

  return {
    profileId: profile.id,
    expiryDays,
    riskScore,
    riskFlags,
    predictedExpiryRisk,
    recommendation,
  };
}

export default function Demo() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const profileCardRefs = useRef(new Map<string, HTMLButtonElement>());
  const profilesById = useMemo(() => new Map(AGENT_PROFILES.map((profile) => [profile.id, profile])), []);

  const insights = useMemo<AiInsight[]>(() => {
    return AGENT_PROFILES.map((profile) => buildInsight(profile)).sort((a, b) => b.riskScore - a.riskScore);
  }, []);
  const insightsById = useMemo(() => new Map(insights.map((insight) => [insight.profileId, insight])), [insights]);

  const selectedProfile = AGENT_PROFILES.find((profile) => profile.id === selectedId) ?? null;
  const selectedInsight = insights.find((insight) => insight.profileId === selectedId) ?? null;
  const selectedDetailId = selectedProfile ? `agent-profile-detail-${selectedProfile.id}` : undefined;

  useEffect(() => {
    if (selectedProfile) {
      collapseButtonRef.current?.focus();
    }
  }, [selectedProfile]);

  const collapseSelectedProfile = (profileId: string | null) => {
    const focusTarget = profileId ? profileCardRefs.current.get(profileId) : null;
    setSelectedId(null);
    requestAnimationFrame(() => focusTarget?.focus());
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Mobile Passport Hub</h1>
            <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">Home</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Supervisor view for fast credential checks, compliance status, and active passport verification.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BrainCircuit className="h-4 w-4 text-primary" />
            AI Compliance Watch
          </div>
          <ul className="space-y-2 text-sm">
            {insights.slice(0, 3).map((insight, index) => {
              const profile = profilesById.get(insight.profileId);
              if (!profile) return null;
              return (
                <li key={insight.profileId} className="rounded-lg border border-border/70 p-3 bg-background/80">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">#{index + 1} {profile.name}</span>
                    <span className="text-xs text-red-300 font-semibold">Risk {insight.riskScore}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{insight.predictedExpiryRisk}</p>
                  <p className="mt-1 text-xs text-foreground">{insight.recommendation}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-4">
          {AGENT_PROFILES.map((profile) => {
            const insight = insightsById.get(profile.id);
            const days = insight?.expiryDays ?? daysToExpiry(profile.passportExpiry);
            const isExpanded = selectedId === profile.id;
            return (
              <button
                key={profile.id}
                ref={(node) => {
                  if (node) profileCardRefs.current.set(profile.id, node);
                  else profileCardRefs.current.delete(profile.id);
                }}
                onClick={() => {
                  if (selectedId === profile.id) {
                    collapseSelectedProfile(profile.id);
                    return;
                  }
                  setSelectedId(profile.id);
                }}
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? selectedDetailId : undefined}
                className={`w-full text-left rounded-xl border bg-card p-4 space-y-3 transition-colors ${
                  isExpanded ? "border-primary" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold leading-snug">{profile.name}</h2>
                    <p className="text-sm text-muted-foreground">{profile.role}</p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0" aria-hidden />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${trainingBadge(profile.trainingStatus)}`}>
                    Training: {profile.trainingStatus}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${expiryBadge(days)}`}>
                    Expiry: {days < 0 ? "expired" : `${days}d`}
                  </span>
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">Active passport:</span>{" "}
                  <span className="font-medium">{profile.activePassportId}</span>
                </p>
              </button>
            );
          })}
        </section>

        {selectedProfile && (
          <section id={selectedDetailId} className="space-y-4">
            <button
              ref={collapseButtonRef}
              onClick={() => collapseSelectedProfile(selectedId)}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ChevronLeft className="h-4 w-4" /> Collapse profile
            </button>

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{selectedProfile.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedProfile.role}</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Active passport:</span>{" "}
                  <span className="font-medium">{selectedProfile.activePassportId}</span>
                </p>
              </div>

              {selectedInsight && (
                <div
                  className={`rounded-lg border p-3 space-y-2 ${
                    selectedInsight.riskScore >= 90
                      ? "border-red-500/30 bg-red-500/10"
                      : selectedInsight.riskScore >= 65
                        ? "border-amber-500/30 bg-amber-500/10"
                        : "border-emerald-500/30 bg-emerald-500/10"
                  }`}
                >
                  <p
                    className={`text-sm font-medium flex items-center gap-2 ${
                      selectedInsight.riskScore >= 90
                        ? "text-red-200"
                        : selectedInsight.riskScore >= 65
                          ? "text-amber-200"
                          : "text-emerald-200"
                    }`}
                  >
                    {selectedInsight.riskScore >= 90 ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : selectedInsight.riskScore >= 65 ? (
                      <FileWarning className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}{" "}
                    AI risk score: {selectedInsight.riskScore}
                  </p>
                  <p
                    className={`text-xs ${
                      selectedInsight.riskScore >= 90
                        ? "text-red-100"
                        : selectedInsight.riskScore >= 65
                          ? "text-amber-100"
                          : "text-emerald-100"
                    }`}
                  >
                    {selectedInsight.predictedExpiryRisk}
                  </p>
                  <p
                    className={`text-xs ${
                      selectedInsight.riskScore >= 90
                        ? "text-red-100"
                        : selectedInsight.riskScore >= 65
                          ? "text-amber-100"
                          : "text-emerald-100"
                    }`}
                  >
                    {selectedInsight.recommendation}
                  </p>
                  <ul
                    className={`list-disc list-inside text-xs space-y-1 ${
                      selectedInsight.riskScore >= 90
                        ? "text-red-100"
                        : selectedInsight.riskScore >= 65
                          ? "text-amber-100"
                          : "text-emerald-100"
                    }`}
                  >
                    {selectedInsight.riskFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Mandatory checks</h3>
                <ul className="space-y-2">
                  {selectedProfile.mandatoryChecks.map((check) => (
                    <li key={check.label} className="rounded-lg border border-border/70 p-2.5 flex items-center justify-between gap-3">
                      <span className="text-sm">{check.label}</span>
                      <span
                        className={`text-xs font-semibold ${
                          check.status === "pass"
                            ? "text-emerald-300"
                            : check.status === "failed"
                              ? "text-red-300"
                              : "text-amber-300"
                        }`}
                      >
                        {check.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Evidence uploads</h3>
                <ul className="space-y-2">
                  {selectedProfile.evidenceUploads.map((item) => (
                    <li key={item.label} className="rounded-lg border border-border/70 p-2.5 flex items-center justify-between gap-3">
                      <span className="text-sm">{item.label}</span>
                      <span className={`text-xs font-semibold ${item.status === "verified" ? "text-emerald-300" : "text-red-300"}`}>
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border/70 p-3 space-y-1.5">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Historical compliance pattern
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedProfile.complianceHistory.month}: {selectedProfile.complianceHistory.misses} misses,{" "}
                  {selectedProfile.complianceHistory.lateRefreshers} late refreshers.
                </p>
                {(selectedProfile.complianceHistory.misses > 1 || selectedProfile.trainingStatus !== "complete") && (
                  <p className="text-xs text-amber-200 flex items-center gap-1.5">
                    <FileWarning className="h-3.5 w-3.5" />
                    AI suggests refresher training and additional documentation review.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
