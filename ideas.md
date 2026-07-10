# S/ Agent Passport — Demo Site Design Brainstorm

## Constraint (brand ground truth)
The S/ brand is fixed: dark navy `#0A1628`, signature orange `#FF4F00`, tagline
"Sovereign. Calibrated. Accountable." The site must feel like the passport card itself:
a sovereign credential system — official, technical, high-trust.

## Three Approaches

### 1. Border Control Terminal
Aesthetic of a passport-control checkpoint: stamped documents, machine-readable zones,
monospace MRZ strips, terminal readouts. Emotionally: crossing a checkpoint into a swarm.
**Probability: 0.07**

### 2. Mission Ops Console
A NASA-style flight-ops console: dense telemetry, dark panels, glowing state indicators.
Emotionally: watching a live swarm from mission control.
**Probability: 0.04**

### 3. Sovereign Ledger
Minimal editorial-brutalist ledger: heavy serif headlines, ruled lines, wax-seal accents.
Emotionally: an official registry book of record.
**Probability: 0.02**

## Chosen: Border Control Terminal

- **Design Movement:** Techno-utilitarian document design — international passport/visa
  typography (ICAO MRZ), blended with terminal/CLI aesthetics. Think "machine-readable
  government document rendered as a dark web console."
- **Core Principles:**
  1. Document authenticity — every block looks like part of an official credential
     (MRZ strips, perforation dots, stamp marks, guilloché-like line patterns).
  2. Machine-readable honesty — real JSON payloads and monospace data everywhere;
     the demo shows actual package semantics, not marketing fluff.
  3. Checkpoint drama — the core interaction is PASS/DENY at a gate; state changes
     are stamped, not faded.
  4. Asymmetric ledger grid — left-anchored rails, offset columns, no centered hero-blob.
- **Color Philosophy:** Navy `#0A1628` is the sovereign field (background of the state);
  orange `#FF4F00` is the stamp ink — used only for authority moments (ACTIVE stamps,
  gate PASS, CTAs, the S/ mark). Denials use a desaturated red; muted steel-blue
  `#5A6B85` for secondary data. Paper-white `#E8EDF5` for primary text.
- **Layout Paradigm:** A vertical "inspection route": hero checkpoint → passport booklet
  (schema) → issuance desk (interactive) → border gate (validation demo) → lineage wall
  (spawn tree) → lifecycle strip → integration annex. Left vertical rail with section
  numbers like passport page numbers (01/07…). Content columns offset right.
- **Signature Elements:**
  1. MRZ (machine-readable zone) strips — `P<SPASS<<AGENT<NAME<<<` monospace bands
     used as section dividers.
  2. Rubber-stamp marks — rotated bordered "ACTIVE"/"REVOKED"/"DENIED" stamps that
     slam in with a scale-settle animation.
  3. Perforation dot rows and dashed cut-lines separating card regions.
- **Interaction Philosophy:** Every interaction mirrors a real package call: click
  "Issue" → a passport materializes with real field values; click "Present at gate" →
  checks run sequentially like border inspection (checklist ticks in order); revoke →
  stamp slams. The UI is a faithful simulator of the Python API.
- **Animation:** Fast ease-out (≤250ms) for UI; stamps use a 300ms scale(1.4→1) +
  slight rotation settle; gate checks tick sequentially at 120ms stagger; MRZ strips
  have a subtle scanline shimmer on hover only. Respect prefers-reduced-motion.
- **Typography System:** "Space Grotesk" (600/700) for display/headers — technical but
  characterful; "IBM Plex Mono" for all data, MRZ, code, and labels. No Inter.
  Hierarchy: giant display numerals for section indices, uppercase letterspaced
  mono labels, generous line-height body.
- **Brand Essence:** The sovereign identity layer for agent swarms — for builders of
  multi-agent systems who need trust without bureaucracy. Adjectives: sovereign,
  exacting, kinetic.
- **Brand Voice:** Imperative border-officer clarity. Examples: "Present your passport."
  / "No passport, no tools. No exceptions." Ban: "Welcome to our website", "Get started today".
- **Wordmark & Logo:** The `S/` slash-mark in orange on navy — rendered big, cropped,
  used as watermark; favicon is the slash glyph.
- **Signature Brand Color:** `#FF4F00` stamp-ink orange.

## Style Decisions
- The `S/` slash-mark must appear as a large recurring authority device — cropped
  watermark, seal, or stamp — not only as a small navbar logo.
- Every primary content panel should borrow from passport/document security language:
  ruled lines, MRZ bands, perforation dots, cut-lines, guilloché patterns, or stamps.
- PASS, DENY, ACTIVE, REVOKED, ISSUED are authority states — always rendered as
  stamped inspection decisions, never ordinary labels.
- Headlines and section numerals should feel severe and ledger-like: uppercase kickers,
  ruled-line framing, giant numerals; hero must preview MRZ + stamp + slash-mark.
