# Outpost Mobile Implementation Plan

> **For agentic workers:** Implement task-by-task. Do not commit unless asked.

**Goal:** Studio Expo app — Home, Leads, Projects/Tickets, Messages.

**Architecture:** Sibling Expo app at `../outpost-mobile`; Supabase Auth + queries; Bearer JWT for Next chat APIs.

## Tasks

1. Design spec (done in `docs/superpowers/specs/2026-07-26-outpost-mobile-design.md`)
2. Scaffold Expo + theme + auth
3. Bearer studio session on chat API routes
4. Home + Leads
5. Projects + Tickets
6. Messages + realtime
