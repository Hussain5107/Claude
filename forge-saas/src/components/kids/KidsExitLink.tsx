import Link from "next/link";
import KidsButton from "./ui/KidsButton";

/**
 * Leaving Kids Mode always goes through /parent, never directly back to
 * /dashboard — /parent is what applies the PIN speed bump
 * (src/app/parent/(dashboard)/layout.tsx). This link itself grants nothing;
 * it is exactly as safe as typing the URL by hand, per
 * docs/kids-mode/00-principles.md P2.
 */
export default function KidsExitLink() {
  return (
    <Link href="/parent">
      <KidsButton variant="secondary" className="mt-2">
        I&apos;m a grown-up
      </KidsButton>
    </Link>
  );
}
