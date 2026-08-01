import { createClient } from "@/lib/supabase/server";
import BottomTabBar from "@/components/BottomTabBar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { resolveTheme } from "@/lib/theme";

/**
 * App shell for every signed-in screen.
 *
 * The theme is read here, once, and applied as `data-theme` on the wrapper —
 * so the colours are already correct in the HTML the browser first paints and
 * nothing swaps afterwards. Every child screen inherits it.
 *
 * The bottom padding is what keeps the last card clear of the fixed tab bar —
 * 68px of bar plus the iPhone home indicator when FORGE runs full screen.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No profile lookup for signed-out visitors — the pages below redirect them
  // to /login anyway, and the default theme is right for that.
  let themeValue: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("theme").eq("id", user.id).single();
    themeValue = data?.theme ?? null;
  }
  const theme = resolveTheme(themeValue);

  return (
    <ThemeProvider theme={theme}>
      <div
        data-theme={theme.name}
        className="app-shell"
        style={{ paddingBottom: "calc(68px + env(safe-area-inset-bottom))" }}
      >
        {children}
        <BottomTabBar />
      </div>
    </ThemeProvider>
  );
}
