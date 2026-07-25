import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Landing when someone opens the portal host without a project token.
 * Real access is always /portal/[token] (+ PIN).
 */
export default function PortalIndexPage() {
  return (
    <div className="portal-skin flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--portal-muted)]">
          Client portal
        </p>
        <h1 className="portal-display mt-3 text-4xl italic leading-none">
          Outpost
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--portal-muted)]">
          Open the secure link your studio shared with you. It looks like{" "}
          <span className="text-[var(--portal-fg)]">
            /portal/your-project-token
          </span>{" "}
          and may ask for a PIN.
        </p>
        {process.env.NEXT_PUBLIC_ADMIN_URL ? (
          <p className="mt-8 text-xs text-[var(--portal-muted)]">
            Studio team?{" "}
            <Link
              href={process.env.NEXT_PUBLIC_ADMIN_URL}
              className="underline decoration-[var(--portal-line)] underline-offset-4 hover:text-[var(--portal-fg)]"
            >
              Go to admin
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
