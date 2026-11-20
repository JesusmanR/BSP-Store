/** Uses the supplied BSP artwork unchanged, with transparent margins trimmed for layout. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`bsp-brand${light ? ' bsp-brand-light' : ''}`}
      role="img"
      aria-label="BSP STORE"
    >
      <img
        className="bsp-brand-emblem"
        src="/brand/bsp-logo.webp"
        alt=""
        width="1197"
        height="498"
      />
      <span className="bsp-brand-wordmark" aria-hidden="true">
        <span>STORE</span>
      </span>
    </span>
  );
}
