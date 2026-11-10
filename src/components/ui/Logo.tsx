export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`} style={{ gap: '10px' }}>
      <img
        src={light ? '/images/logo-bsp-dark.jpg' : '/images/logo-bsp-light.jpg'}
        alt="Emblema oficial BSP Store"
        width={48}
        height={48}
        style={{
          width: '48px',
          height: '48px',
          objectFit: 'contain',
          borderRadius: '8px',
          flexShrink: 0,
        }}
      />
      <strong>
        BSP<span>STORE</span>
      </strong>
      <span className="logo-dot">®</span>
    </span>
  );
}
