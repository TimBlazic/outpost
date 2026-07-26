# Bulk AI reprice (selected leads)

## Goal

Re-estimate deal `value` for selected leads with AI + Settings pricing guidance, without running full qualify.

## Behavior

- Leads bulk bar: **Reprice selected (N)** when selection non-empty.
- Server action loads firm pricing guidance + each lead’s company, category, website, description (and current value for context).
- Short Anthropic call → JSON `{ value: number }` only.
- Persist only `lead.value` (clamped like qualify). Optional activity note “AI reprice: X → Y EUR”.
- Skip leads with no company and no description; report updated / skipped / failed counts.
- Process sequentially (or small concurrency) to respect rate limits.

## Out of scope

- Changing rating, status, draft, research markdown, tags.
- Background job queue (sync server action for selected set is enough for now).
