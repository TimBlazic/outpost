# AI Lead Email — Design

**Date:** 2026-07-25  
**Status:** Approved for implementation

## Goal

Generate top-tier outreach emails from a lead (cold / follow-up / custom), with an editable system prompt in Settings. Settings page split into tabs.

## Provider

- **Anthropic Claude Sonnet** (default model via `ANTHROPIC_MODEL`, fallback `claude-sonnet-4-5`)
- API key: `ANTHROPIC_API_KEY` in `.env.local` (server-only)
- Cost at solo volume is negligible; quality prioritized over mini models

## Lead UX

1. **Generate email** button on lead detail
2. Popover: intent chips (`cold` | `follow_up` | `custom`) + optional brief
3. Actions:
   - **Mail now** → generate → open `mailto:` with subject + body
   - **Just generate** → generate → side drawer to edit
4. Drawer: edit subject/body, Regenerate, Open in mail, **Save** (as lead note), Discard

## Settings

Tabs: **Profile** | **Studio** | **Billing** | **AI**  
AI tab: editable system prompt (+ reset to default).

## Data

- `firm_settings.ai_email_system_prompt` (text)
- Prompt is voice/rules; lead context + intent + brief injected per request
- Follow-up includes recent activities in the user message

## Out of scope (v1)

- Sending email via SMTP/API
- Multi-provider switching UI
- Storing every generation history
