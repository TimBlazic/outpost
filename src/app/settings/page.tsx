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
    <div className="flex h-full min-h-0 flex-col gap-6 p-4 lg:p-6">
      <PageHeader
        title="Settings"
        description="Profile, studio, billing, email, AI, and dashboard KPIs."
      />
      <Tabs
        defaultValue="profile"
        className="flex min-h-0 flex-1 flex-col gap-6"
      >
        <TabsList className="shrink-0">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent
          value="profile"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <ProfileForm profile={profile} />
        </TabsContent>
        <TabsContent
          value="studio"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <SettingsForm settings={settings} section="studio" />
        </TabsContent>
        <TabsContent
          value="billing"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <SettingsForm settings={settings} section="billing" />
        </TabsContent>
        <TabsContent
          value="email"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <SettingsForm settings={settings} section="email" />
        </TabsContent>
        <TabsContent
          value="ai"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <SettingsForm settings={settings} section="ai" />
        </TabsContent>
        <TabsContent
          value="dashboard"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <SettingsForm settings={settings} section="dashboard" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
