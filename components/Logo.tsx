/** iRaMzipa mark: a tile with an upward "install" arrow. Uses the active palette via CSS variables. */
export function Logo({ size = 32, logoUrl }: { size?: number; logoUrl?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" width={size} height={size} className="app-icon" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="irz-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--primary)" }} />
          <stop offset="1" style={{ stopColor: "var(--primary-dark)" }} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#irz-mark)" />
      <path d="M32 13 46 29h-8v21H26V29h-8z" fill="#fff" />
      <rect x="18" y="45" width="28" height="5" rx="2.5" fill="#fff" opacity="0.85" />
    </svg>
  );
}
