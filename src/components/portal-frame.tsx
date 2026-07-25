import { getPortalTheme, PORTAL_THEME_COOKIE } from "@/lib/portal/theme";

/**
 * Full-bleed portal chrome (same as /portal layout). Use for session-based
 * client routes under /projects so they don't inherit the studio AppShell look.
 */
export async function PortalFrame({ children }: { children: React.ReactNode }) {
  const theme = await getPortalTheme();
  const antiFlash = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${PORTAL_THEME_COOKIE}=([^;]+)/);var t=m&&m[1]==='light'?'light':'dark';var el=document.currentScript&&document.currentScript.parentElement;if(el)el.setAttribute('data-theme',t);}catch(e){}})();`;

  return (
    <div
      className="portal-skin flex h-dvh max-h-dvh flex-col overflow-hidden"
      data-theme={theme}
    >
      <script dangerouslySetInnerHTML={{ __html: antiFlash }} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
