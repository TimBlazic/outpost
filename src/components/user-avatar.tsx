import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsFromName, type Member } from "@/lib/data";
import { cn } from "@/lib/utils";

export function UserAvatar({
  member,
  name,
  avatarUrl,
  initials,
  size = "md",
  className,
  fallbackClassName,
}: {
  member?: Pick<Member, "name" | "initials" | "avatarUrl"> | null;
  name?: string;
  avatarUrl?: string | null;
  initials?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  fallbackClassName?: string;
}) {
  const displayName = member?.name ?? name ?? "?";
  const url = member?.avatarUrl ?? avatarUrl ?? null;
  const letters =
    member?.initials ||
    initials ||
    initialsFromName(displayName);

  return (
    <Avatar
      className={cn(
        size === "sm" && "size-7",
        size === "md" && "size-8",
        size === "lg" && "size-14",
        className
      )}
    >
      {url ? <AvatarImage src={url} alt={displayName} /> : null}
      <AvatarFallback
        className={cn(
          "bg-primary text-primary-foreground",
          size === "sm" && "text-[10px]",
          size === "lg" && "text-base",
          fallbackClassName
        )}
      >
        {letters}
      </AvatarFallback>
    </Avatar>
  );
}
