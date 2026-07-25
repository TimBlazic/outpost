import { PageHeader } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { ProfileForm } from "@/components/profile-form";
import { getFirmSettings } from "@/lib/store";
import { getCurrentProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, profile] = await Promise.all([
    getFirmSettings(),
    getCurrentProfile(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Settings"
        description="Your profile and the numbers that power your dashboard."
      />
      <ProfileForm profile={profile} />
      <SettingsForm settings={settings} />
    </div>
  );
}
