import Image from "next/image";

/**
 * The user's profile picture.
 *
 * When there's no photo it falls back to their initial on the theme gradient
 * rather than a generic person glyph — it looks deliberate instead of empty,
 * and it still reads as "this is you".
 */
interface Props {
  url: string | null;
  /** Used for the initial when there's no photo. */
  name?: string;
  size: number;
  /** A gradient ring around the photo. Worth it on the home screen, too loud
   *  in a compact header. */
  ring?: boolean;
  className?: string;
}

export default function Avatar({ url, name, size, ring = false, className = "" }: Props) {
  const initial = name?.trim()?.charAt(0)?.toUpperCase() ?? "";

  const inner = (
    <span
      className="relative block overflow-hidden rounded-full bg-[var(--surface-hi)]"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image src={url} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : initial ? (
        <span
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] font-extrabold text-white"
          style={{ fontSize: size * 0.42 }}
        >
          {initial}
        </span>
      ) : (
        <span className="flex h-full w-full items-center justify-center" style={{ fontSize: size * 0.45 }}>
          👤
        </span>
      )}
    </span>
  );

  if (!ring) {
    return <span className={`block shrink-0 border border-[var(--border-hi)] rounded-full ${className}`}>{inner}</span>;
  }

  return (
    <span
      className={`block shrink-0 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] p-[2px] ${className}`}
    >
      <span className="block rounded-full bg-[var(--bg)] p-[2px]">{inner}</span>
    </span>
  );
}
