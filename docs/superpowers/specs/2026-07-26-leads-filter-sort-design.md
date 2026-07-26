# Leads filter + sort — Design

**Date:** 2026-07-26  
**Status:** Approved (implement)

**Approach:** URL query params; Open preset default; clickable table headers

## Filters

- **Open** chip (default when `status` missing or `status=open`): exclude Won / Lost / Not suitable
- **Status** multi-select → `status=New,Contacted` (disables Open)
- **Source** multi-select → `source=Website,Referral`
- **Clear** → `status=all`, drop `source`
- Text → `q=` (synced)
- Applies to Table + Kanban

## Sort (table only)

Keys: `company` | `status` (pipeline order) | `value` | `probability` | `followUp` | `score`  
URL: `sort=` + `dir=asc|desc`  
Default: `followUp` asc, nulls last

## Out of scope

Owner, tags, score range, server-side sort
