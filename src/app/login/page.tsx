import Link from "next/link";

import { login } from "@/lib/auth/actions";
import { isSupabaseEnabled } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/", error } = await searchParams;
  const enabled = isSupabaseEnabled();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="app-reveal w-full max-w-md space-y-8">
        <div>
          <p className="text-xs tracking-[0.22em] uppercase text-muted-foreground">
            Studio
          </p>
          <h1 className="app-display mt-3 text-5xl italic leading-none">
            Outpost
          </h1>
          <p className="mt-4 text-muted-foreground">
            {enabled
              ? "Sign in to continue to your pipeline."
              : "Local development mode — auth is off."}
          </p>
        </div>

        {!enabled ? (
          <div className="space-y-4">
            <Button asChild className="h-11 w-full">
              <Link href="/">Go to dashboard</Link>
            </Button>
          </div>
        ) : (
          <form action={login} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-11 bg-card/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 bg-card/60"
              />
            </div>
            <Button type="submit" className="h-11 w-full">
              Continue
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
