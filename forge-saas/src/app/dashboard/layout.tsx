import BottomTabBar from "@/components/BottomTabBar";

/**
 * App shell for every signed-in screen.
 *
 * The bottom padding is what keeps the last card clear of the fixed tab bar —
 * 64px of bar plus the iPhone home indicator when FORGE runs full screen.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: "calc(68px + env(safe-area-inset-bottom))" }}>
      {children}
      <BottomTabBar />
    </div>
  );
}
