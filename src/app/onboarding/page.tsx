import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/session";
import { requireClientSession } from "@/lib/client-accounts/session";
import { ClientOnboardingForm } from "@/components/client-onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { client } = await requireClientSession();
  if (client.onboardingCompletedAt) {
    redirect("/projects");
  }

  const profile = await getCurrentProfile();

  return (
    <div
      className="portal-skin flex min-h-screen items-center justify-center px-6 py-10"
      data-theme="light"
    >
      <ClientOnboardingForm
        locale={client.portalLocale}
        defaults={{
          firstName: client.firstName ?? "",
          lastName: client.lastName ?? "",
          company: client.company ?? "",
          billingAddress: client.billingAddress ?? "",
          taxNumber: client.taxNumber ?? "",
          vatId: client.vatId ?? "",
          registrationNumber: client.registrationNumber ?? "",
          billingKind: client.billingKind ?? "person",
          profileName: profile.name,
          profileAvatarUrl: profile.avatarUrl,
          profileInitials: profile.initials,
        }}
      />
    </div>
  );
}
