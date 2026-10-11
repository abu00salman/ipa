/** App icon with a letter fallback when no icon has been extracted or uploaded yet. */
export function AppIcon({ slug, name, hasIcon, size }: { slug: string; name: string; hasIcon: boolean; size: number }) {
  if (hasIcon) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/icon/${slug}`} alt="" width={size} height={size} className="app-icon" loading="lazy" decoding="async" />;
  }
  return (
    <div
      aria-hidden="true"
      className="app-icon app-icon-fallback"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
