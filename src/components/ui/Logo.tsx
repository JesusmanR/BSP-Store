export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`} style={{ gap: '10px' }}>
      <img
        src="/images/logo-bsp.png"
        alt="BSP"
        width={102}
        height={44}
        style={{
          height: '42px',
          width: 'auto',
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
      <strong style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span
          style={{
            fontSize: '15px',
            letterSpacing: '4px',
            fontWeight: 800,
            paddingTop: 0,
            paddingLeft: '2px',
            lineHeight: 1,
          }}
        >
          STORE
        </span>
      </strong>
      <span className="logo-dot">®</span>
    </span>
  );
}
