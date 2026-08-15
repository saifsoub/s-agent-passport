# S/Agency Model Assets v0.1

This folder is the canonical registry for S/Agency model assets.

## Control Model

- GitHub is the source of truth.
- Google Sheets is the operating workbook.
- The owned knowledge graph renderer is the visual relationship map.
- Supabase is a prepared runtime mirror, not the canonical record.
- No model asset becomes runtime-active without owner approval and a passport scope.

## Connected Workbook

https://docs.google.com/spreadsheets/d/1yt4NBzqHKiwjZDDbcPqPh78pw1_yOMwCYImVl48eJjo/edit

## Files

- `registry/model-assets.v0.1.json`: governed Hugging Face model assets.
- `registry/advisory-skills.v0.1.json`: advisory skills used to evaluate and route assets.
- `graph/knowledge-graph.v0.1.json`: graph nodes and edges for the S/Agency control map.
- `supabase/s_agency_model_assets.prepared.sql`: prepared Supabase/Postgres mirror contract.

## Activation Status

The first approved runtime-ready assets are:

- `LiquidAI/LFM2.5-2.6B`
- `openai/whisper-large-v3`
- `sentence-transformers/all-MiniLM-L6-v2`

High-risk visual/audio/video assets stay `registry_only` until owner-reviewed.
