/*
 * Border Control Terminal · mock Live Registry data
 * A fixed fleet of sample passports representing a running S-OS swarm.
 * Deterministic (no random IDs) so the grid is stable across renders.
 */
import type { Passport, PassportStatus, AgentType } from "@/lib/passport";
import { computeChecksum } from "@/lib/passport";

interface MockSpec {
  id: string;
  name: string;
  type: AgentType;
  status: PassportStatus;
  issued: string;
  expires: string | null;
  caps: string[];
  perms: Record<string, boolean>;
  calibration: number | null;
  parent?: string;
  signed: boolean;
}

const SPECS: MockSpec[] = [
  {
    id: "S-PASS-7C41A9E20B58",
    name: "s_orchestrator_v3",
    type: "orchestrator",
    status: "active",
    issued: "2026-07-08T06:15:00Z",
    expires: null,
    caps: ["project_read", "data_pipeline_analyze", "supabase_query", "report_generation", "agent_spawn"],
    perms: { can_access_projects: true, can_spawn_children: true, can_write_memory: true, can_trigger_deploy: false },
    calibration: 5,
    signed: true,
  },
  {
    id: "S-PASS-2F8D6B1C93E7",
    name: "s_content_engine_v2",
    type: "content_engine",
    status: "active",
    issued: "2026-07-08T09:40:00Z",
    expires: null,
    caps: ["web_research", "copywriting", "image_prompt_gen", "pdf_assembly", "brand_compliance_check"],
    perms: { can_write_memory: true, can_publish_external: false },
    calibration: 4,
    signed: true,
  },
  {
    id: "S-PASS-B3E19F04D267",
    name: "analyst_child_1",
    type: "analyst",
    status: "active",
    issued: "2026-07-09T11:05:00Z",
    expires: "2026-07-11T11:05:00Z",
    caps: ["supabase_query", "report_generation"],
    perms: { can_write_memory: true, can_spawn_children: false },
    calibration: 3,
    parent: "S-PASS-7C41A9E20B58",
    signed: true,
  },
  {
    id: "S-PASS-905A7D3EC1F4",
    name: "swarm_node_worker_07",
    type: "swarm_node",
    status: "active",
    issued: "2026-07-10T04:00:00Z",
    expires: "2026-07-10T10:00:00Z",
    caps: ["task_execution"],
    perms: { can_write_memory: false },
    calibration: 2,
    signed: false,
  },
  {
    id: "S-PASS-4D72C8A6F0B9",
    name: "research_scout_v1",
    type: "researcher",
    status: "paused",
    issued: "2026-07-06T14:20:00Z",
    expires: null,
    caps: ["web_search", "trend_analysis", "pdf_parse"],
    perms: { can_write_memory: true },
    calibration: 3,
    signed: true,
  },
  {
    id: "S-PASS-E86B04F92A3D",
    name: "memory_bridge_core",
    type: "memory_bridge",
    status: "active",
    issued: "2026-07-05T08:00:00Z",
    expires: null,
    caps: ["memory_read", "memory_write", "calibration_sync"],
    perms: { can_write_memory: true, can_access_projects: true },
    calibration: 6,
    signed: true,
  },
  {
    id: "S-PASS-1A5F3C9D80E2",
    name: "rogue_deployer",
    type: "executor",
    status: "revoked",
    issued: "2026-07-09T16:45:00Z",
    expires: null,
    caps: ["task_execution"],
    perms: { can_trigger_deploy: false },
    calibration: 1,
    signed: false,
  },
  {
    id: "S-PASS-6E0D9B2C47A1",
    name: "swarm_node_worker_03",
    type: "swarm_node",
    status: "expired",
    issued: "2026-07-09T02:00:00Z",
    expires: "2026-07-09T08:00:00Z",
    caps: ["task_execution"],
    perms: { can_write_memory: false },
    calibration: 2,
    signed: false,
  },
  {
    id: "S-PASS-C2947E5A1D68",
    name: "coder_agent_v1_legacy",
    type: "coder",
    status: "archived",
    issued: "2026-06-20T10:30:00Z",
    expires: null,
    caps: ["code_generation", "test_execution"],
    perms: { can_write_memory: true, can_trigger_deploy: false },
    calibration: 4,
    signed: true,
  },
];

function build(spec: MockSpec): Passport {
  const base = {
    passport_id: spec.id,
    agent_name: spec.name,
    agent_type: spec.type,
    version: "1.0.0",
    creator: "Seif Alsoub / S/",
    issued_at: spec.issued,
  };
  return {
    ...base,
    expires_at: spec.expires,
    capabilities: spec.caps,
    permissions: spec.perms,
    memory_bridge_ref: spec.calibration !== null && spec.calibration >= 4 ? "s_agent_calib_2026-07-08_core" : null,
    calibration_level: spec.calibration,
    provenance: [
      { event: "issued", actor: "Seif Alsoub / S-OS", timestamp: spec.issued, detail: {} },
      ...(spec.status !== "active"
        ? [{ event: spec.status, actor: "Seif Alsoub / S-OS", timestamp: spec.issued, detail: {} }]
        : []),
    ],
    parent_passport_id: spec.parent ?? null,
    status: spec.status,
    branding: {
      primary_color: "#0A1628",
      accent_color: "#D97742",
      logo_ref: "s_logo_dark.png",
      tagline: "Sovereign. Calibrated. Accountable.",
    },
    metadata: { owner: "Seif Alsoub", registry: "mock" },
    checksum: computeChecksum(base),
    signature: spec.signed ? "ed25519:" + spec.id.slice(7).toLowerCase() + "9f2ce8a1b7d4" : null,
    signer_public_key: spec.signed ? "s-pass-issuer.pub" : null,
  };
}

export const MOCK_REGISTRY: Passport[] = SPECS.map(build);
