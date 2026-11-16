export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`} style={{ gap: '8px' }}>
      <img
        src="/images/logo-bsp.png"
        alt="BSP"
        width={96}
        height={42}
        style={{
          height: '40px',
          width: 'auto',
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
      <strong style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span
          style={{
            fontSize: '10px',
            letterSpacing: '5.5px',
            fontWeight: 700,
            paddingTop: 0,
            paddingLeft: '2px',
          }}
        >
          STORE
        </span>
      </strong>
      <span className="logo-dot">®</span>
    </span>
  );
}
