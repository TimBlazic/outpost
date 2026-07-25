-- Demo seed for Outpost — clients, projects, tickets, files, pipeline leads.
-- Run AFTER all migrations (incl. 20260724180000_clients_tickets.sql).
-- Safe to re-run (on conflict do nothing).
--
-- owner_id / author ids use local placeholders u1 / u2.
-- After invite, optionally update them to your auth.users uuid:
--   update projects set owner_id = '<your-uuid>' where owner_id in ('u1','u2');

-- ---------------------------------------------------------------------------
-- Pipeline leads (sales)
-- ---------------------------------------------------------------------------

insert into public.leads (
  id, company, website, contact, email, phone, country,
  category, source, owner_id, status, value, probability,
  first_contact, last_contact, next_follow_up, tags, created_by
) values
(
  'l_seed1',
  'Nordic Coffee',
  'nordiccoffee.dk',
  'Maja Nielsen',
  'maja@nordiccoffee.dk',
  '+45 20 00 00 01',
  'Denmark',
  'E-commerce',
  'Cold email',
  'u1',
  'Follow-up needed',
  7500,
  45,
  current_date - 18,
  current_date - 3,
  current_date + 1,
  array['seed', 'eu'],
  'u1'
),
(
  'l_seed2',
  'Harbor Legal',
  'harborlegal.com',
  'Tom Ellis',
  'tom@harborlegal.com',
  '',
  'UK',
  'Agency',
  'Referral',
  'u2',
  'Proposal sent',
  12000,
  60,
  current_date - 30,
  current_date - 5,
  current_date + 3,
  array['seed', 'proposal'],
  'u2'
),
(
  'l_seed3',
  'Pulse Analytics',
  'pulseanalytics.io',
  'Sara Kovač',
  'sara@pulseanalytics.io',
  '+386 40 111 222',
  'Slovenia',
  'SaaS',
  'Referral',
  'u1',
  'Won',
  15000,
  100,
  current_date - 60,
  current_date - 40,
  null,
  array['seed', 'won'],
  'u1'
)
on conflict (id) do nothing;

insert into public.notes (id, lead_id, title, body, pinned, date, user_id) values
(
  'n_seed1',
  'l_seed1',
  'Discovery call',
  'Wants a redesign + Shopify migration. Budget around €7–8k. Decision maker is Maja.',
  true,
  current_date - 10,
  'u1'
),
(
  'n_seed2',
  'l_seed2',
  'Proposal draft',
  'Sent 3-page proposal: IA rewrite, case study pages, intake form. Waiting on partner feedback.',
  false,
  current_date - 5,
  'u2'
)
on conflict (id) do nothing;

insert into public.activities (
  id, lead_id, type, title, detail, date, user_id
) values
(
  'a_seed1',
  'l_seed1',
  'email',
  'Follow-up #2 sent',
  'Asked about timeline for Q3 launch.',
  current_date - 3,
  'u1'
),
(
  'a_seed2',
  'l_seed2',
  'meeting',
  'Proposal walkthrough',
  '45 min — liked scope, need firm price by Friday.',
  current_date - 5,
  'u2'
),
(
  'a_seed3',
  'l_seed3',
  'status',
  'Status changed to Won',
  'Converted to project: Pulse Analytics — Web app',
  current_date - 40,
  'u1'
)
on conflict (id) do nothing;

insert into public.tasks (
  id, title, lead_id, project_id, assigned_to, due, priority, status, reminder
) values
(
  't_seed1',
  'Call Nordic Coffee — budget check',
  'l_seed1',
  null,
  'u1',
  current_date + 1,
  'High',
  'Todo',
  true
),
(
  't_seed2',
  'Send Harbor Legal revised quote',
  'l_seed2',
  null,
  'u2',
  current_date + 2,
  'Medium',
  'In progress',
  false
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------

insert into public.clients (
  id, name, email, phone, company, website, country, notes, lead_id, created_at
) values
(
  'c_seed_pulse',
  'Pulse Analytics',
  'sara@pulseanalytics.io',
  '+386 40 111 222',
  'Pulse Analytics d.o.o.',
  'pulseanalytics.io',
  'Slovenia',
  'SaaS analytics product. Prefers async updates in portal.',
  'l_seed3',
  now() - interval '45 days'
),
(
  'c_seed_aurora',
  'Aurora Spa',
  'hello@auroraspa.si',
  '+386 51 222 333',
  'Aurora Spa',
  'auroraspa.si',
  'Slovenia',
  'Boutique spa brand. Brand assets in Drive.',
  null,
  now() - interval '120 days'
),
(
  'c_seed_finchley',
  'Finchley',
  'ops@finchley.app',
  '',
  'Finchley Ltd',
  'finchley.app',
  'UK',
  'Mobile product team. Weekly sync Fridays.',
  null,
  now() - interval '90 days'
),
(
  'c_seed_casa',
  'Casa Nova',
  'info@casanova.it',
  '',
  'Casa Nova SRL',
  'casanova.it',
  'Italy',
  'Hospitality group — new marketing site.',
  null,
  now() - interval '30 days'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

insert into public.projects (
  id, name, client, client_id, description, phase, type, value, status,
  start_date, estimated_end, actual_end, owner_id, cost, source, lead_id,
  portal_enabled, staging_url, portal_intro,
  client_can_view_tickets, client_can_create_tickets,
  client_can_upload_files, client_can_comment
) values
(
  'p_seed_pulse',
  'Pulse Analytics — Web app',
  'Pulse Analytics',
  'c_seed_pulse',
  'Dashboards, billing, and client reporting for the Pulse SaaS product.',
  'Build',
  'Web app',
  15000,
  'In progress',
  current_date - 55,
  current_date + 20,
  null,
  'u2',
  1200,
  'Referral',
  'l_seed3',
  false,
  'https://pulse-staging.example.com',
  'Staging is live — open tickets for anything that feels off.',
  true, true, true, true
),
(
  'p_seed_aurora',
  'Aurora Spa — Redesign',
  'Aurora Spa',
  'c_seed_aurora',
  'Full marketing site redesign: treatments, booking CTA, multilingual SI/EN.',
  'Handoff',
  'Website redesign',
  6800,
  'Completed',
  current_date - 130,
  current_date - 95,
  current_date - 98,
  'u1',
  400,
  'Upwork',
  null,
  false,
  null,
  null,
  true, true, true, true
),
(
  'p_seed_finchley',
  'Finchley App',
  'Finchley',
  'c_seed_finchley',
  'Consumer mobile app — onboarding, home feed, and push notifications.',
  'Build',
  'Mobile app',
  22000,
  'In progress',
  current_date - 100,
  current_date + 40,
  null,
  'u1',
  3000,
  'Referral',
  null,
  false,
  'https://finchley-staging.example.com',
  'Use tickets for bugs and content requests.',
  true, true, true, true
),
(
  'p_seed_casa',
  'Casa Nova — New site',
  'Casa Nova',
  'c_seed_casa',
  'New brochure site for the hotel group. Discovery wrapping up.',
  'Discovery',
  'New website',
  4200,
  'Discovery',
  current_date - 12,
  current_date + 25,
  null,
  'u1',
  0,
  'Website',
  null,
  false,
  null,
  'Kickoff done — share brand files whenever ready.',
  true, true, true, true
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

insert into public.payments (
  id, project_id, label, percent, due_on, paid, paid_on
) values
('pay_pulse_1', 'p_seed_pulse', 'Deposit', 20, current_date - 55, true, current_date - 56),
('pay_pulse_2', 'p_seed_pulse', 'Midway', 50, current_date - 10, false, null),
('pay_pulse_3', 'p_seed_pulse', 'Final', 30, current_date + 20, false, null),
('pay_aurora_1', 'p_seed_aurora', 'Deposit', 50, current_date - 130, true, current_date - 131),
('pay_aurora_2', 'p_seed_aurora', 'Final', 50, current_date - 95, true, current_date - 97),
('pay_finch_1', 'p_seed_finchley', 'Deposit', 30, current_date - 100, true, current_date - 102),
('pay_finch_2', 'p_seed_finchley', 'Milestone 1', 40, current_date - 20, false, null),
('pay_finch_3', 'p_seed_finchley', 'Final', 30, current_date + 40, false, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------

insert into public.tickets (
  id, project_id, title, description, status, created_at, due_at,
  assignee_kind, assignee_id, created_by_kind, created_by_name
) values
(
  'tk_seed_1',
  'p_seed_pulse',
  'Review staging homepage copy',
  E'Please check the hero and pricing copy on staging.\n\n- Tone OK?\n- Any missing CTAs?\n\nLink: https://pulse-staging.example.com',
  'Waiting on client',
  now() - interval '8 days',
  current_date + 2,
  'client',
  null,
  'studio',
  'Tim'
),
(
  'tk_seed_2',
  'p_seed_pulse',
  'Wire auth redirect after signup',
  E'Users land on a blank page after email confirm.\n\nExpected: redirect to `/app`.\nRepro: sign up with a fresh email on staging.',
  'In progress',
  now() - interval '6 days',
  current_date + 5,
  'studio',
  'u2',
  'studio',
  'Tim'
),
(
  'tk_seed_3',
  'p_seed_pulse',
  'Export CSV for admin reports',
  E'Need CSV export on the Reports screen — date range + columns matching the table.',
  'Todo',
  now() - interval '2 days',
  current_date + 12,
  'studio',
  'u2',
  'client',
  'Sara'
),
(
  'tk_seed_4',
  'p_seed_pulse',
  'Logo lockup for invoices',
  E'Done — invoice PDF uses the new horizontal lockup.',
  'Done',
  now() - interval '20 days',
  current_date - 15,
  'studio',
  'u1',
  'studio',
  'Tim'
),
(
  'tk_seed_5',
  'p_seed_finchley',
  'Push permission copy (EN)',
  E'Draft soft-ask copy for the notification permission screen.\n\nKeep it under 2 sentences.',
  'Waiting on client',
  now() - interval '4 days',
  current_date + 3,
  'client',
  null,
  'studio',
  'Tim'
),
(
  'tk_seed_6',
  'p_seed_finchley',
  'Crash on cold start (iOS 17)',
  E'Reported by TestFlight build 42.\n\nStack hints at Keychain read during splash.',
  'In progress',
  now() - interval '1 day',
  current_date + 4,
  'studio',
  'u1',
  'studio',
  'Luka'
),
(
  'tk_seed_7',
  'p_seed_casa',
  'Share brand guidelines PDF',
  E'Please upload the brand book + logo pack when ready.',
  'Todo',
  now() - interval '3 days',
  current_date + 7,
  'client',
  null,
  'studio',
  'Tim'
),
(
  'tk_seed_8',
  'p_seed_aurora',
  'Final content tweaks (EN)',
  E'Completed before launch — archived for reference.',
  'Done',
  now() - interval '100 days',
  current_date - 96,
  'studio',
  'u1',
  'client',
  'Aurora'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Ticket comments + reactions
-- ---------------------------------------------------------------------------

insert into public.ticket_comments (
  id, ticket_id, parent_id, body, author_kind, author_name, author_id, created_at, edited_at
) values
(
  'tc_seed_1',
  'tk_seed_1',
  null,
  'Hey @Client — staging hero is ready for your eyes. Anything off?',
  'studio',
  'Tim',
  'u1',
  now() - interval '7 days',
  null
),
(
  'tc_seed_2',
  'tk_seed_1',
  'tc_seed_1',
  'Looks good — can we soften the CTA a bit?',
  'client',
  'Pulse Analytics',
  null,
  now() - interval '6 days 12 hours',
  null
),
(
  'tc_seed_3',
  'tk_seed_2',
  null,
  '@Studio — I can jump on the redirect after lunch.',
  'studio',
  'Ana',
  'u2',
  now() - interval '5 days',
  null
)
on conflict (id) do nothing;

insert into public.ticket_comment_reactions (
  id, comment_id, emoji, author_kind, author_name, created_at
) values
(
  'tcr_seed_1',
  'tc_seed_2',
  '👍',
  'studio',
  'Tim',
  now() - interval '6 days'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Attachments (URL links — no Storage upload required)
-- ---------------------------------------------------------------------------

insert into public.attachments (
  id, parent_type, parent_id, label, kind, url, storage_path, mime, size
) values
-- Project files
(
  'f_seed_pulse_contract',
  'project',
  'p_seed_pulse',
  'Signed contract (PDF)',
  'doc',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  null,
  'application/pdf',
  13264
),
(
  'f_seed_pulse_figma',
  'project',
  'p_seed_pulse',
  'UI — Figma',
  'figma',
  'https://www.figma.com',
  null,
  null,
  null
),
(
  'f_seed_pulse_invoice',
  'project',
  'p_seed_pulse',
  'Invoice #1 — Deposit',
  'doc',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  null,
  'application/pdf',
  13264
),
(
  'f_seed_aurora_brand',
  'project',
  'p_seed_aurora',
  'Brand kit',
  'drive',
  'https://drive.google.com',
  null,
  null,
  null
),
(
  'f_seed_finch_brief',
  'project',
  'p_seed_finchley',
  'Product brief',
  'doc',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  null,
  'application/pdf',
  13264
),
(
  'f_seed_casa_mood',
  'project',
  'p_seed_casa',
  'Moodboard',
  'figma',
  'https://www.figma.com',
  null,
  null,
  null
),
-- Ticket attachments
(
  'f_seed_tk1_shot',
  'ticket',
  'tk_seed_1',
  'Homepage screenshot',
  'screenshot',
  'https://placehold.co/1200x800/png',
  null,
  'image/png',
  null
),
(
  'f_seed_tk2_log',
  'ticket',
  'tk_seed_2',
  'Console log snippet',
  'doc',
  'https://example.com/auth-redirect-notes',
  null,
  null,
  null
),
-- Lead attachments
(
  'f_seed_lead1_site',
  'lead',
  'l_seed1',
  'Current website',
  'website',
  'https://nordiccoffee.dk',
  null,
  null,
  null
),
(
  'f_seed_lead2_prop',
  'lead',
  'l_seed2',
  'Proposal draft',
  'proposal',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  null,
  'application/pdf',
  13264
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Docs
-- ---------------------------------------------------------------------------

insert into public.docs (
  id, title, category, excerpt, body, author_id, last_edited, tags, favorite
) values
(
  'd_seed1',
  'Welcome to Outpost',
  'Sales Process',
  'How to use this workspace day to day.',
  E'# Welcome\n\n- Track leads on the board\n- Convert won deals → Client + Project\n- Run delivery with Tickets + Files\n- Share a portal link + PIN with the client\n',
  'u1',
  current_date,
  array['getting-started'],
  true
),
(
  'd_seed2',
  'Ticket hygiene',
  'Project Delivery',
  'How we write tickets clients can actually answer.',
  E'# Ticket hygiene\n\n- One ask per ticket\n- Link staging / Figma\n- Put the due date when the client owns the next step\n',
  'u2',
  current_date - 2,
  array['delivery', 'tickets'],
  false
)
on conflict (id) do nothing;
