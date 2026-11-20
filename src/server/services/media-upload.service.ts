import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '@/server/http/errors';

export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB exacto
export const ALLOWED_MEDIA_FOLDERS = ['avatars', 'catalog'] as const;
export type MediaFolder = (typeof ALLOWED_MEDIA_FOLDERS)[number];

export type DetectedRasterMime = 'image/png' | 'image/jpeg' | 'image/webp';

const MIME_TO_EXT: Record<DetectedRasterMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const EXT_TO_MIME: Record<string, DetectedRasterMime> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

const UUID_FILENAME_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

const SAFE_LOCAL_RASTER_PATH_REGEX = /^\/(images|brand)\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp)$/i;
const SAFE_LOCAL_CATALOG_PATH_REGEX =
  /^\/(images|brand)\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|svg)$/i;
const SAFE_MANAGED_MEDIA_PATH_REGEX =
  /^\/api\/v1\/media\/(avatars|catalog)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

const TRUSTED_AVATAR_HTTPS_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
]);

/**
 * Raíz de almacenamiento local controlado fuera de public/ (preparado para Object Storage / S3 / R2).
 */
export function getMediaStorageRoot(): string {
  const configured = process.env.MEDIA_STORAGE_DIR?.trim();
  return path.resolve(configured || path.join(process.cwd(), 'storage', 'uploads'));
}

/**
 * Inspecciona estrictamente los magic bytes reales del binario.
 * Solo acepta PNG, JPEG o WebP auténticos; rechaza SVG, HTML, JS, ejecutables o binarios falsificados.
 */
export function detectImageMimeFromMagicBytes(buf: Buffer): DetectedRasterMime | null {
  if (!buf || buf.byteLength < 12) return null;

  // Bloqueo explícito de firmas textuales activas (SVG, XML, HTML, JS) aunque haya espacios iniciales
  const headText = buf.subarray(0, Math.min(256, buf.byteLength)).toString('utf8').trimStart().toLowerCase();
  if (
    headText.startsWith('<svg') ||
    headText.startsWith('<?xml') ||
    headText.startsWith('<!doctype') ||
    headText.startsWith('<html') ||
    headText.startsWith('<script')
  ) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Valida tamaño exacto (<= 2 MB) y coherencia de magic bytes frente al MIME declarado.
 */
export function validateImageUploadBuffer(
  buf: Buffer,
  declaredMime?: string | null
): { mimeType: DetectedRasterMime; ext: string } {
  if (!buf || buf.byteLength === 0) {
    throw new AppError('EMPTY_FILE', 'El archivo de imagen está vacío.', 400);
  }
  if (buf.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new AppError(
      'FILE_TOO_LARGE',
      'La imagen excede el tamaño máximo permitido de 2 MB.',
      413
    );
  }

  const normalizedDeclared = (declaredMime || '').trim().toLowerCase();
  if (
    normalizedDeclared &&
    (normalizedDeclared.includes('svg') ||
      normalizedDeclared.includes('html') ||
      normalizedDeclared.includes('javascript'))
  ) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Por seguridad no se permiten archivos SVG, HTML ni scripts. Sube una imagen PNG, JPG o WebP.',
      415
    );
  }

  const detected = detectImageMimeFromMagicBytes(buf);
  if (!detected) {
    throw new AppError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Formato de imagen no válido o firma binaria incompatible. Solo se permiten PNG, JPG o WebP reales.',
      415
    );
  }

  if (normalizedDeclared) {
    const canonicalDeclared =
      normalizedDeclared === 'image/jpg' ? 'image/jpeg' : normalizedDeclared;
    if (
      canonicalDeclared !== 'application/octet-stream' &&
      canonicalDeclared !== detected
    ) {
      throw new AppError(
        'MIME_MISMATCH',
        'El tipo MIME declarado no coincide con el contenido real de la imagen.',
        415
      );
    }
  }

  return { mimeType: detected, ext: MIME_TO_EXT[detected] };
}

/**
 * Guarda una imagen validada con nombre UUID criptográfico en almacenamiento controlado.
 */
export async function saveUploadedImage(
  folder: MediaFolder,
  buf: Buffer,
  declaredMime?: string | null
): Promise<{ url: string; mimeType: DetectedRasterMime; sizeBytes: number; filename: string }> {
  if (!ALLOWED_MEDIA_FOLDERS.includes(folder)) {
    throw new AppError('INVALID_MEDIA_FOLDER', 'Carpeta de almacenamiento no permitida.', 400);
  }

  const { mimeType, ext } = validateImageUploadBuffer(buf, declaredMime);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const folderPath = path.resolve(getMediaStorageRoot(), folder);
  await fs.mkdir(folderPath, { recursive: true });

  const targetPath = path.resolve(folderPath, filename);
  if (!targetPath.startsWith(folderPath + path.sep)) {
    throw new AppError('INVALID_MEDIA_PATH', 'Ruta de almacenamiento inválida.', 400);
  }

  await fs.writeFile(targetPath, buf, { flag: 'wx' });

  return {
    url: `/api/v1/media/${folder}/${filename}`,
    mimeType,
    sizeBytes: buf.byteLength,
    filename,
  };
}

/**
 * Lee de forma confinada un archivo gestionado por UUID, bloqueando cualquier intento de Path Traversal.
 */
export async function readManagedMediaFile(
  folder: string,
  filename: string
): Promise<{ buffer: Buffer; mimeType: DetectedRasterMime }> {
  if (!ALLOWED_MEDIA_FOLDERS.includes(folder as MediaFolder)) {
    throw new AppError('INVALID_MEDIA_PATH', 'Carpeta de media no permitida.', 400);
  }

  if (
    !filename ||
    filename.includes('\0') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..') ||
    filename.includes('%') ||
    !UUID_FILENAME_REGEX.test(filename)
  ) {
    throw new AppError('INVALID_MEDIA_PATH', 'Nombre de archivo inválido.', 400);
  }

  const folderRoot = path.resolve(getMediaStorageRoot(), folder);
  const resolved = path.resolve(folderRoot, filename);
  if (!resolved.startsWith(folderRoot + path.sep)) {
    throw new AppError('INVALID_MEDIA_PATH', 'Acceso denegado fuera del directorio permitido.', 400);
  }

  try {
    const buffer = await fs.readFile(resolved);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = EXT_TO_MIME[ext];
    if (!mimeType) {
      throw new AppError('INVALID_MEDIA_PATH', 'Extensión de archivo no permitida.', 400);
    }
    return { buffer, mimeType };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('MEDIA_NOT_FOUND', 'Archivo multimedia no encontrado.', 404);
  }
}

/**
 * Elimina un archivo multimedia previo gestionado por el servidor (ej. al cambiar avatar).
 */
export async function deleteManagedMediaByUrl(url?: string | null): Promise<void> {
  if (!url || !SAFE_MANAGED_MEDIA_PATH_REGEX.test(url)) return;
  const parts = url.split('/');
  const folder = parts[4];
  const filename = parts[5];
  if (!folder || !filename) return;
  const folderRoot = path.resolve(getMediaStorageRoot(), folder);
  const resolved = path.resolve(folderRoot, filename);
  if (!resolved.startsWith(folderRoot + path.sep)) return;
  try {
    await fs.unlink(resolved);
  } catch {
    // El archivo ya no existe; ignorar de forma segura
  }
}

/**
 * Valida estrictamente URLs de avatar o catálogo:
 * - Bloquea traversal (.., %2e, \, //, null bytes)
 * - Bloquea esquemas peligrosos (javascript:, vbscript:, data:text/html, data:image/svg+xml)
 * - Si llega data:image/(png|jpeg|webp);base64,..., decodifica y valida sus magic bytes reales.
 */
export function isSafeMediaUrl(
  rawUrl: string,
  options?: { allowCatalogSvgPresets?: boolean; allowAnyTrustedHttps?: boolean }
): boolean {
  const val = rawUrl.trim();
  if (!val || val.length > 450_000) return false;
  if (
    val.includes('\0') ||
    val.includes('\\') ||
    val.includes('..') ||
    /%2e|%2f|%5c|%00/i.test(val)
  ) {
    return false;
  }

  const lower = val.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('data:text/') ||
    lower.startsWith('data:image/svg')
  ) {
    return false;
  }

  // 1. Archivos gestionados por nuestro endpoint UUID (/api/v1/media/...)
  if (SAFE_MANAGED_MEDIA_PATH_REGEX.test(val)) {
    return true;
  }

  // 2. Recursos estáticos locales bajo /images/ o /brand/
  if (val.startsWith('/')) {
    if (val.startsWith('//') || val.includes('?') || val.includes('#')) return false;
    return options?.allowCatalogSvgPresets
      ? SAFE_LOCAL_CATALOG_PATH_REGEX.test(val)
      : SAFE_LOCAL_RASTER_PATH_REGEX.test(val);
  }

  // 3. Data URLs raster con verificación real de magic bytes
  const dataMatch = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(val);
  if (dataMatch) {
    const declared = dataMatch[1] === 'image/jpg' ? 'image/jpeg' : dataMatch[1]!;
    const b64 = dataMatch[2]!;
    try {
      const decoded = Buffer.from(b64, 'base64');
      if (decoded.byteLength > 350_000) return false;
      const detected = detectImageMimeFromMagicBytes(decoded);
      return detected !== null && detected === declared;
    } catch {
      return false;
    }
  }

  // 4. URLs HTTPS confiables (bloqueando SVG remoto y HTTP plano)
  try {
    const parsed = new URL(val);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.pathname.toLowerCase().endsWith('.svg')) return false;
    if (options?.allowAnyTrustedHttps) {
      return true;
    }
    return TRUSTED_AVATAR_HTTPS_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
