-- Task description + file attachments on tasks

alter table public.tasks
  add column if not exists description text not null default '';

alter table public.attachments drop constraint if exists attachments_parent_type_check;
alter table public.attachments
  add constraint attachments_parent_type_check
  check (parent_type in ('lead', 'project', 'doc', 'portal_update', 'ticket', 'ticket_comment', 'task'));
