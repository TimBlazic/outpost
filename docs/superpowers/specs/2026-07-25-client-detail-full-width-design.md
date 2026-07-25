# Client detail full width

## Goal

Make the client detail page use the full main content width, matching project detail.

## Decision

Change the root wrapper on `src/app/clients/[id]/page.tsx` from a centered `max-w-5xl` layout to full width:

- **From:** `mx-auto max-w-5xl space-y-8 p-4 lg:p-6`
- **To:** `w-full space-y-8 p-4 lg:p-6`

This mirrors `ProjectWorkspace` (`w-full space-y-8 p-4 lg:p-6`).

## Out of scope

- No sidebar / shell changes
- No Messages-style `overflow-hidden` viewport workspace
- No content, section, or data changes

## Acceptance

- Client detail spans the main pane width like project detail
- Padding and vertical spacing unchanged
- Page still scrolls in the main area
