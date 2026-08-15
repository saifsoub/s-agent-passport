# S/Agency Model Asset Registry Design

## Goal

Create a governed model-asset layer for S/Agency that lets model capabilities be reviewed, assigned, visualized, and later mirrored into Supabase without losing owner control.

## Architecture

GitHub is the canonical source of truth. The Google Sheet workbook is the connected operating surface. Ace Knowledge Graph is the visual map. Supabase is a prepared runtime mirror and should not be applied until the owner approves the exact table and access policy.

## Components

- `s-agency/model-assets/registry/model-assets.v0.1.json`: model asset records.
- `s-agency/model-assets/registry/advisory-skills.v0.1.json`: advisor skill stack.
- `s-agency/model-assets/ace/knowledge-graph.v0.1.json`: graph source.
- `s-agency/model-assets/supabase/s_agency_model_assets.prepared.sql`: runtime mirror contract.
- Google Sheet `Agent_memory`: operating tabs and approval fields.

## Governance

Every runtime candidate has `owner_control`, `approval_status`, `passport_requirement`, and `activation_status`. High-risk video, image, and audio models remain registry-only until reviewed. Runtime-ready assets are limited to lower-risk utility roles first.

## Validation

The connected workbook was verified for formula resolution and dropdown-backed controls. Supabase SQL is prepared only; it was not applied to a live project.
