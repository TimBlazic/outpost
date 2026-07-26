# Resend email signature — Design

**Date:** 2026-07-26  
**Status:** Approved for implementation

## Behavior

When sending via Resend (`sendStudioEmail`), append this signature under the message body:

```
Tim Blažič
timblazic.dev
Programiranje, Tim Blažič s.p.
```

- `timblazic.dev` is a link to `https://timblazic.dev` in HTML
- Plain-text version includes the same lines (URL as `https://timblazic.dev` or bare host)
- Activity log stores the body **with** signature (what was sent)
- **Open in mail / mailto** paths do not append the signature

## Implementation

- Helper in `src/lib/email/signature.ts`
- Applied only inside `src/lib/email/resend.ts` before `emails.send`
- Send both `text` and `html` (HTML needed for clickable link)
