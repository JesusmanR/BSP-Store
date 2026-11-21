import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'out');
const DIST_DIR = path.join(ROOT, 'dist-hostinger');
const PHP_API_DIR = path.join(ROOT, 'php-api');
const STASH_DIR = path.join(ROOT, '.hostinger-build-stash');

// Archivos server-only de Next.js que se ocultan temporalmente durante la exportación estática
// (en Hostinger son reemplazados por php-api/ + .htaccess)
const SERVER_ONLY_PATHS = [
  'src/app/api',
  'src/middleware.ts',
  'src/app/admin/layout.tsx',
  'src/app/producto/[idOrSlug]',
];

function copyRecursive(src, dest, excludeNames = new Set()) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (excludeNames.has(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry), excludeNames);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function stashServerOnlyFiles() {
  fs.rmSync(STASH_DIR, { recursive: true, force: true });
  fs.mkdirSync(STASH_DIR, { recursive: true });

  for (const rel of SERVER_ONLY_PATHS) {
    const absSrc = path.join(ROOT, rel);
    if (fs.existsSync(absSrc)) {
      const absDst = path.join(STASH_DIR, rel);
      fs.mkdirSync(path.dirname(absDst), { recursive: true });
      fs.renameSync(absSrc, absDst);
    }
  }
}

function restoreServerOnlyFiles() {
  for (const rel of SERVER_ONLY_PATHS) {
    const absDst = path.join(STASH_DIR, rel);
    if (fs.existsSync(absDst)) {
      const absSrc = path.join(ROOT, rel);
      fs.mkdirSync(path.dirname(absSrc), { recursive: true });
      fs.renameSync(absDst, absSrc);
    }
  }
  fs.rmSync(STASH_DIR, { recursive: true, force: true });
}

console.log('==> [1/4] Preparando exportación estática de BSP Store para Hostinger...');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.rmSync(path.join(ROOT, '.next'), { recursive: true, force: true });

stashServerOnlyFiles();

try {
  console.log('==> [2/4] Compilando frontend estático Next.js (HOSTINGER_EXPORT=true)...');
  execSync('npx next build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      HOSTINGER_EXPORT: 'true',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
} finally {
  console.log('==> [3/4] Restaurando archivos de entorno local...');
  restoreServerOnlyFiles();
}

console.log('==> [4/4] Ensamblando paquete listo para FileZilla en dist-hostinger/...');
copyRecursive(OUT_DIR, DIST_DIR);

// Copiar backend PHP 8 + MySQL dentro de dist-hostinger/api/
copyRecursive(
  PHP_API_DIR,
  path.join(DIST_DIR, 'api'),
  new Set(['config.php', 'htaccess-root.txt', 'tests'])
);

// Asegurar carpetas de subida protegidas
fs.mkdirSync(path.join(DIST_DIR, 'api', 'storage', 'uploads', 'avatars'), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'api', 'storage', 'uploads', 'catalog'), { recursive: true });

// Copiar .htaccess principal en la raíz de public_html
fs.copyFileSync(
  path.join(PHP_API_DIR, 'htaccess-root.txt'),
  path.join(DIST_DIR, '.htaccess')
);

// Copiar SQL y guía a una carpeta fuera de public_html? Dejamos copia accesible en raíz de proyecto y guía
const sqlSrc = path.join(PHP_API_DIR, 'database', 'bsp_store_mysql.sql');
const guideSrc = path.join(ROOT, 'docs', 'GUIA_SUBIDA_FILEZILLA_HOSTINGER.md');
if (fs.existsSync(sqlSrc)) {
  fs.copyFileSync(sqlSrc, path.join(ROOT, 'IMPORTAR_EN_PHPMYADMIN_bsp_store.sql'));
}
if (fs.existsSync(guideSrc)) {
  console.log('    Guía disponible en: docs/GUIA_SUBIDA_FILEZILLA_HOSTINGER.md');
}

console.log('\n✅ ¡Paquete Hostinger listo en: dist-hostinger/ !');
console.log('   1. Importa php-api/database/bsp_store_mysql.sql en Hostinger phpMyAdmin.');
console.log('   2. Sube TODO el contenido de dist-hostinger/ a public_html/ por FileZilla.');
console.log('   3. Copia public_html/api/config.example.php a public_html/api/config.php con tus datos MySQL.');
