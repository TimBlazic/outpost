# Qualify pricing guidance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or implement directly in-session).

**Goal:** Editable Settings → AI pricing note wired into qualify verdict; remove hardcoded pricing bands.

**Tech:** Next.js + Supabase `firm_settings` column; mirror `aiEmailSystemPrompt` pattern.

## Tasks

1. Migration `ai_qualify_pricing_prompt` + `FirmSettings` type/mapper/defaults
2. Default constant + Settings AI textarea (save/reset like email prompt)
3. Wire `runQualifyVerdict` + orchestrate; soften clamp min to 500
4. Verify tsc; user runs SQL migration on Supabase
