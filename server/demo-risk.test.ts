import { describe, expect, it } from "vitest";
import { buildInsight, daysToExpiry, type AgentProfile } from "../client/src/pages/Demo";

const NOW = Date.UTC(2026, 8, 15, 10, 0, 0);

function makeProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: "test-1",
    name: "Test Worker",
    role: "Worker",
    activePassportId: "S-PASS-TEST",
    trainingStatus: "complete",
    passportExpiry: "2026-11-30",
    mandatoryChecks: [
      { label: "ID verification", status: "pass" },
      { label: "Safety induction", status: "pass" },
    ],
    evidenceUploads: [{ label: "Medical certificate", status: "verified" }],
    complianceHistory: { month: "Aug", misses: 0, lateRefreshers: 0 },
    ...overrides,
  };
}

describe("daysToExpiry", () => {
  it("returns 0 for same-day expiry", () => {
    expect(daysToExpiry("2026-09-15", NOW)).toBe(0);
  });

  it("returns negative value for already expired passports", () => {
    expect(daysToExpiry("2026-09-14", NOW)).toBe(-1);
  });
});

describe("buildInsight", () => {
  it("produces a low-risk recommendation", () => {
    const insight = buildInsight(makeProfile(), NOW);
    expect(insight.recommendation).toBe("Keep in routine audit cycle.");
    expect(insight.riskScore).toBeLessThan(65);
  });

  it("produces a medium-risk recommendation", () => {
    const insight = buildInsight(
      makeProfile({
        trainingStatus: "due",
        passportExpiry: "2026-10-05",
        mandatoryChecks: [
          { label: "ID verification", status: "pass" },
          { label: "Safety induction", status: "failed" },
        ],
        evidenceUploads: [{ label: "Medical certificate", status: "missing" }],
        complianceHistory: { month: "Aug", misses: 1, lateRefreshers: 1 },
      }),
      NOW,
    );

    expect(insight.recommendation).toBe("Prioritize in today's verification queue.");
    expect(insight.riskFlags).toContain("Mandatory checks incomplete");
    expect(insight.predictedExpiryRisk).toBe("High renewal pressure");
  });

  it("produces a high-risk recommendation", () => {
    const insight = buildInsight(
      makeProfile({
        trainingStatus: "overdue",
        passportExpiry: "2026-09-18",
        mandatoryChecks: [
          { label: "ID verification", status: "missing" },
          { label: "Safety induction", status: "failed" },
        ],
        evidenceUploads: [{ label: "Medical certificate", status: "missing" }],
        complianceHistory: { month: "Aug", misses: 3, lateRefreshers: 2 },
      }),
      NOW,
    );

    expect(insight.recommendation).toBe("Verify immediately before site entry.");
    expect(insight.riskFlags).toContain("Pattern: repeated compliance misses");
    expect(insight.predictedExpiryRisk).toBe("Critical renewal window");
  });
});
