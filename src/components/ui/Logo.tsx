export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      <span className="logo-slashes">///</span>
      <strong>
        BSP<span>STORE</span>
      </strong>
      <span className="logo-dot">®</span>
    </span>
  );
}
