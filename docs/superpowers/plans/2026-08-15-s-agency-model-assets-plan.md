# S/Agency Model Asset Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a governed S/Agency model asset registry connected across GitHub, Google Sheets, an owned knowledge graph source/render contract, and a prepared Supabase mirror.

**Architecture:** GitHub stores the canonical asset records. Google Sheets gives the owner an editable operating surface. The owned graph renderer reads the canonical nodes and edges JSON. Supabase remains a prepared mirror until the live project and access model are confirmed.

**Tech Stack:** GitHub contents API, Google Sheets batchUpdate, owned JSON graph render contract, prepared PostgreSQL/Supabase SQL.

## Global Constraints

- GitHub is the source of truth.
- Google Sheets is the operating workbook.
- Supabase is not applied until owner approval.
- Every runtime asset requires passport scope.
- High-risk media generation assets stay owner-gated.
- Graph rendering must be owned by the launch surface, not blocked by an external graph provider.

---

### Task 1: Workbook Operating Surface

**Files:**
- Modify: Google Sheet `Agent_memory`

**Interfaces:**
- Consumes: model asset rows and advisory skill rows.
- Produces: connected tabs `S Agency Dashboard`, `S Model Assets`, `S Advisory Skills`, `S Agent Assignments`, `S Supabase Mirror`, `S Knowledge Graph Edges`.

- [x] Create connected tabs.
- [x] Add formula-driven dashboard metrics.
- [x] Add dropdown controls for risk, approval, passport, activation, and assignment status.
- [x] Verify formulas and validation-backed fields.

### Task 2: GitHub Canonical Registry

**Files:**
- Create: `s-agency/model-assets/README.md`
- Create: `s-agency/model-assets/registry/model-assets.v0.1.json`
- Create: `s-agency/model-assets/registry/advisory-skills.v0.1.json`

**Interfaces:**
- Consumes: workbook asset rows.
- Produces: versioned canonical registry.

- [x] Create model asset registry JSON.
- [x] Create advisory skills JSON.
- [x] Document source-of-truth rules.

### Task 3: Supabase Prepared Mirror

**Files:**
- Create: `s-agency/model-assets/supabase/s_agency_model_assets.prepared.sql`

**Interfaces:**
- Consumes: registry fields.
- Produces: prepared SQL contract.

- [x] Create table contract with checks for risk, approval, passport, activation, and mirror status.
- [x] Enable RLS.
- [x] Leave live policies unapplied until the live project and owner role model are confirmed.

### Task 4: Owned Knowledge Graph Source and Render

**Files:**
- Create: `s-agency/model-assets/graph/knowledge-graph.v0.1.json`

**Interfaces:**
- Consumes: workbook graph edge rows.
- Produces: graph source and owned rendered graph.

- [x] Create graph source JSON.
- [ ] Render owned knowledge graph from canonical nodes and edges JSON in the launch surface.
