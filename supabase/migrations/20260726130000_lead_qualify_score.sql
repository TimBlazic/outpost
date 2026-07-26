-- Persist Qualify fit score + verdict rating on leads

alter table public.leads
  add column if not exists qualify_score integer
    check (qualify_score is null or (qualify_score >= 0 and qualify_score <= 100));

alter table public.leads
  add column if not exists qualify_rating text
    check (qualify_rating is null or qualify_rating in ('go', 'maybe', 'no-go'));
