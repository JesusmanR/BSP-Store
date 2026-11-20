export interface ClientCardExportData {
  exportedAt: string;
  subject: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
    createdAt: string;
    role?: { code: string; name: string } | null;
    addresses?: Array<{
      label: string;
      streetAddress: string;
      city: string;
      department: string;
      isDefault?: boolean;
    }>;
    orders?: Array<{
      orderNumber: string;
      totalCop: number;
      status: string;
      createdAt: string;
    }>;
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function compressAvatarImageToDataUrl(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP (no se permiten archivos SVG).');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen debe pesar como máximo 5 MB.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No fue posible leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });

  const img = await loadImage(rawDataUrl);
  if (!img) {
    throw new Error('El archivo no es una imagen válida.');
  }

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Tu navegador no soporta el procesamiento de imagen.');
  }

  const minSide = Math.min(img.width, img.height);
  const sx = (img.width - minSide) / 2;
  const sy = (img.height - minSide) / 2;
  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

  const webp = canvas.toDataURL('image/webp', 0.85);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', 0.86);
}

export async function downloadClientDataCardPng(data: ClientCardExportData): Promise<void> {
  const addresses = data.subject.addresses ?? [];
  const orders = data.subject.orders ?? [];

  const width = 1200;
  const height = 980;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  // Fondo base BSP Store oscuro
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0B121F');
  bgGrad.addColorStop(0.55, '#101B2D');
  bgGrad.addColorStop(1, '#0A101B');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Halo radial azul BSP
  const glow = ctx.createRadialGradient(980, 120, 20, 980, 120, 480);
  glow.addColorStop(0, 'rgba(22, 139, 255, 0.22)');
  glow.addColorStop(1, 'rgba(22, 139, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Marco principal
  drawRoundedRect(ctx, 44, 44, width - 88, height - 88, 22);
  ctx.fillStyle = '#131D2B';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#263850';
  ctx.stroke();

  // Banda superior institucional
  drawRoundedRect(ctx, 44, 44, width - 88, 128, 22);
  ctx.fillStyle = '#18263A';
  ctx.fill();

  const logoImg = await loadImage('/brand/bsp-logo.webp');
  if (logoImg) {
    ctx.drawImage(logoImg, 84, 78, 132, 55);
  } else {
    ctx.fillStyle = '#55B7FF';
    ctx.font = '800 34px Sora, Inter, sans-serif';
    ctx.fillText('BSP STORE', 84, 118);
  }

  ctx.fillStyle = '#9FB5D1';
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillText('STORE · COLOMBIA', 86, 152);

  // Badge Habeas Data
  drawRoundedRect(ctx, width - 386, 82, 302, 42, 21);
  ctx.fillStyle = '#143329';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#2D5946';
  ctx.stroke();
  ctx.fillStyle = '#9AD8BE';
  ctx.font = '700 13px Inter, sans-serif';
  ctx.fillText('HABEAS DATA · LEY 1581 DE 2012', width - 356, 108);

  // Título principal
  ctx.fillStyle = '#72BAFF';
  ctx.font = '700 13px Inter, sans-serif';
  ctx.fillText('CERTIFICADO PERSONAL DE TITULARIDAD DE DATOS', 84, 214);
  ctx.fillStyle = '#F4F7FB';
  ctx.font = '700 32px Sora, Inter, sans-serif';
  ctx.fillText('Tarjeta de Datos del Cliente', 84, 254);

  ctx.fillStyle = '#8FA3BD';
  ctx.font = '400 14px Inter, sans-serif';
  const exportedDate = new Date(data.exportedAt).toLocaleString('es-CO');
  ctx.fillText(`Emitido el ${exportedDate} · bspstore.com.co`, 84, 282);

  // Tarjeta de identidad y avatar
  drawRoundedRect(ctx, 84, 312, width - 168, 178, 16);
  ctx.fillStyle = '#0F1825';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#24354B';
  ctx.stroke();

  // Avatar circular
  const avatarCx = 166;
  const avatarCy = 401;
  const avatarR = 52;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#182F49';
  ctx.fill();
  ctx.clip();

  const avatarImg = data.subject.avatarUrl ? await loadImage(data.subject.avatarUrl) : null;
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
  } else {
    ctx.fillStyle = '#72BAFF';
    ctx.font = '700 34px Sora, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((data.subject.name || 'BS').slice(0, 2).toUpperCase(), avatarCx, avatarCy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 3, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#168BFF';
  ctx.stroke();

  // Datos personales
  ctx.fillStyle = '#F4F7FB';
  ctx.font = '700 26px Sora, Inter, sans-serif';
  ctx.fillText(data.subject.name || 'Cliente BSP Store', 246, 370);

  ctx.fillStyle = '#72BAFF';
  ctx.font = '600 15px Inter, sans-serif';
  ctx.fillText(data.subject.email, 246, 400);

  ctx.fillStyle = '#A0AFC3';
  ctx.font = '500 14px Inter, sans-serif';
  const phoneText = data.subject.phone ? `Celular / WhatsApp: ${data.subject.phone}` : 'Celular: No registrado';
  const joinedText = `Miembro desde: ${new Date(data.subject.createdAt).toLocaleDateString('es-CO')}`;
  ctx.fillText(`${phoneText}   ·   ${joinedText}`, 246, 432);

  // KPI pills derecha
  const kpis = [
    { label: 'PEDIDOS', value: String(orders.length) },
    { label: 'DIRECCIONES', value: String(addresses.length) },
    { label: 'PERFIL', value: 'Usuario' },
  ];
  kpis.forEach((kpi, idx) => {
    const kx = 770 + idx * 116;
    drawRoundedRect(ctx, kx, 356, 102, 88, 12);
    ctx.fillStyle = '#162436';
    ctx.fill();
    ctx.strokeStyle = '#2A3F5B';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#8FA3BD';
    ctx.font = '700 10px Inter, sans-serif';
    ctx.fillText(kpi.label, kx + 14, 382);
    ctx.fillStyle = '#F4F7FB';
    ctx.font = '700 22px Sora, Inter, sans-serif';
    ctx.fillText(kpi.value, kx + 14, 422);
  });

  // Sección inferior: 2 columnas (Direcciones y Pedidos)
  const colY = 520;
  const colH = 310;
  const colW = (width - 196) / 2;

  // Columna 1: Direcciones guardadas
  drawRoundedRect(ctx, 84, colY, colW, colH, 16);
  ctx.fillStyle = '#0F1825';
  ctx.fill();
  ctx.strokeStyle = '#24354B';
  ctx.stroke();

  ctx.fillStyle = '#72BAFF';
  ctx.font = '700 12px Inter, sans-serif';
  ctx.fillText('LIBRETA DE DIRECCIONES', 110, colY + 38);

  if (addresses.length === 0) {
    ctx.fillStyle = '#8FA3BD';
    ctx.font = '400 14px Inter, sans-serif';
    ctx.fillText('No tienes direcciones registradas actualmente.', 110, colY + 80);
  } else {
    addresses.slice(0, 3).forEach((addr, idx) => {
      const ay = colY + 68 + idx * 74;
      ctx.fillStyle = '#F4F7FB';
      ctx.font = '700 15px Inter, sans-serif';
      ctx.fillText(
        `${addr.label}${addr.isDefault ? ' (Principal)' : ''}`,
        110,
        ay
      );
      ctx.fillStyle = '#B8C6D9';
      ctx.font = '400 13px Inter, sans-serif';
      ctx.fillText(addr.streetAddress.slice(0, 48), 110, ay + 22);
      ctx.fillStyle = '#7E93AD';
      ctx.font = '400 12px Inter, sans-serif';
      ctx.fillText(`${addr.city}, ${addr.department}`, 110, ay + 42);
    });
  }

  // Columna 2: Resumen de pedidos
  const col2X = 84 + colW + 28;
  drawRoundedRect(ctx, col2X, colY, colW, colH, 16);
  ctx.fillStyle = '#0F1825';
  ctx.fill();
  ctx.strokeStyle = '#24354B';
  ctx.stroke();

  ctx.fillStyle = '#72BAFF';
  ctx.font = '700 12px Inter, sans-serif';
  ctx.fillText('HISTORIAL RECIENTE DE PEDIDOS', col2X + 26, colY + 38);

  if (orders.length === 0) {
    ctx.fillStyle = '#8FA3BD';
    ctx.font = '400 14px Inter, sans-serif';
    ctx.fillText('Aún no registras pedidos en tu cuenta.', col2X + 26, colY + 80);
  } else {
    orders.slice(0, 4).forEach((ord, idx) => {
      const oy = colY + 72 + idx * 56;
      ctx.fillStyle = '#F4F7FB';
      ctx.font = '700 14px Inter, sans-serif';
      ctx.fillText(ord.orderNumber, col2X + 26, oy);
      ctx.fillStyle = '#72BAFF';
      ctx.font = '700 14px Inter, sans-serif';
      const formattedTotal = `$ ${Number(ord.totalCop || 0).toLocaleString('es-CO')} COP`;
      ctx.fillText(formattedTotal, col2X + 240, oy);
      ctx.fillStyle = '#8FA3BD';
      ctx.font = '400 12px Inter, sans-serif';
      ctx.fillText(
        `${new Date(ord.createdAt).toLocaleDateString('es-CO')} · Estado: ${ord.status}`,
        col2X + 26,
        oy + 20
      );
    });
  }

  // Pie legal
  ctx.fillStyle = '#7E93AD';
  ctx.font = '400 12px Inter, sans-serif';
  ctx.fillText(
    'BSP Store Colombia · Bucaramanga, Santander · WhatsApp: 302 800 0240 · compras@bspstore.com.co',
    84,
    height - 92
  );
  ctx.fillStyle = '#5F7490';
  ctx.font = '400 11px Inter, sans-serif';
  ctx.fillText(
    'Documento personal generado conforme al derecho de acceso y portabilidad (Ley 1581 de 2012 y Decreto 1377 de 2013).',
    84,
    height - 70
  );

  const safeSlug = (data.subject.name || 'cliente')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `bsp-store-mis-datos-${safeSlug || 'cliente'}.png`;
  a.click();
}
