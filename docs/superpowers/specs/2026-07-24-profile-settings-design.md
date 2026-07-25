# Profile settings

Profile section on `/settings` (above Firm). Editable: name, avatar image. Role display-only.

- Supabase: `profiles.avatar_url` + Storage `avatars`
- File store: `data/profiles.json` + local uploads
- Shared `UserAvatar` used in sidebar, comments, assignees, owners
- Name change updates denormalized `authorName` / display via `memberById` + comment rewrite by `authorId`
