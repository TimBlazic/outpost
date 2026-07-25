import { PageHeader } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { ProfileForm } from "@/components/profile-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        description="Profile, studio goals, billing, and AI."
      />
      <Tabs defaultValue="profile" className="gap-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileForm profile={profile} />
        </TabsContent>
        <TabsContent value="studio">
          <SettingsForm settings={settings} section="studio" />
        </TabsContent>
        <TabsContent value="billing">
          <SettingsForm settings={settings} section="billing" />
        </TabsContent>
        <TabsContent value="ai">
          <SettingsForm settings={settings} section="ai" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
