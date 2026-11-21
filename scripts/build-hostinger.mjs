import { execSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
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

function copyRecursive(src, dest, excludePredicate = () => false) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      const fullSrc = path.join(src, entry);
      if (excludePredicate(entry, fullSrc)) continue;
      copyRecursive(fullSrc, path.join(dest, entry), excludePredicate);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function resolvePhpBinary() {
  const candidates = ['php'];
  if (process.platform === 'win32') {
    const wingetBase = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetBase)) {
      for (const dir of fs.readdirSync(wingetBase)) {
        if (dir.startsWith('PHP.PHP.')) {
          const candidate = path.join(wingetBase, dir, 'php.exe');
          if (fs.existsSync(candidate)) candidates.push(candidate);
        }
      }
    }
  }

  for (const bin of candidates) {
    const res = spawnSync(bin, ['-v'], { encoding: 'utf8' });
    if (res.status === 0) return bin;
  }
  return null;
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

console.log('==> [1/5] Preparando exportación estática de BSP Store para Hostinger (Solo FileZilla)...');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.rmSync(path.join(ROOT, '.next'), { recursive: true, force: true });

stashServerOnlyFiles();

try {
  console.log('==> [2/5] Compilando frontend estático Next.js (HOSTINGER_EXPORT=true)...');
  execSync('npx next build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      HOSTINGER_EXPORT: 'true',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
} finally {
  console.log('==> [3/5] Restaurando archivos de entorno local...');
  restoreServerOnlyFiles();
}

console.log('==> [4/5] Ensamblando paquete Plug & Play para FileZilla en dist-hostinger/...');
copyRecursive(OUT_DIR, DIST_DIR);

// Copiar backend PHP 8 (SQLite Zero-Config + MySQL compatible) dentro de dist-hostinger/api/
const excludedNames = new Set(['config.php', 'htaccess-root.txt', 'tests']);
copyRecursive(PHP_API_DIR, path.join(DIST_DIR, 'api'), (entry) => {
  if (excludedNames.has(entry)) return true;
  if (/\.sqlite(-wal|-shm)?$/i.test(entry)) return true;
  return false;
});

// Asegurar carpetas protegidas de base de datos y subidas
const distDbDir = path.join(DIST_DIR, 'api', 'storage', 'db');
const distAvatarsDir = path.join(DIST_DIR, 'api', 'storage', 'uploads', 'avatars');
const distCatalogDir = path.join(DIST_DIR, 'api', 'storage', 'uploads', 'catalog');
fs.mkdirSync(distDbDir, { recursive: true });
fs.mkdirSync(distAvatarsDir, { recursive: true });
fs.mkdirSync(distCatalogDir, { recursive: true });

// Garantizar .htaccess en raíz, storage/db y storage/uploads
fs.copyFileSync(path.join(PHP_API_DIR, 'htaccess-root.txt'), path.join(DIST_DIR, '.htaccess'));
fs.copyFileSync(
  path.join(PHP_API_DIR, 'storage', 'db', '.htaccess'),
  path.join(distDbDir, '.htaccess')
);
fs.copyFileSync(
  path.join(PHP_API_DIR, 'storage', 'uploads', '.htaccess'),
  path.join(DIST_DIR, 'api', 'storage', 'uploads', '.htaccess')
);

// Generar dist-hostinger/api/config.php listo para producción (SQLite + secretos criptográficos únicos)
const authSecret = crypto.randomBytes(32).toString('hex');
const cronSecret = crypto.randomBytes(32).toString('hex');
const configTemplate = fs.readFileSync(path.join(PHP_API_DIR, 'config.example.php'), 'utf8');
const generatedConfig = configTemplate
  .replace('REEMPLAZAR_POR_SECRETO_ALEATORIO_64_CARACTERES_HEX_UNICO', authSecret)
  .replace("'cron_secret' => '',", `'cron_secret' => '${cronSecret}',`);
fs.writeFileSync(path.join(DIST_DIR, 'api', 'config.php'), generatedConfig, 'utf8');

console.log('==> [5/5] Pre-inicializando base de datos SQLite lista para subir...');
const sqliteTarget = path.join(distDbDir, 'bsp_store.sqlite');
const phpBin = resolvePhpBinary();
if (phpBin) {
  const schemaPath = path.join(DIST_DIR, 'api', 'database', 'schema_sqlite.php').replace(/\\/g, '/');
  const dbPathNormalized = sqliteTarget.replace(/\\/g, '/');
  const initCode = [
    `require '${schemaPath}';`,
    `$pdo = new PDO('sqlite:${dbPathNormalized}', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);`,
    `init_sqlite_database($pdo);`,
    `$pdo->exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;');`,
    `$tables = (int) $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchColumn();`,
    `$prods = (int) $pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();`,
    `$users = (int) $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();`,
    `echo "SQLite pre-creada: {$tables} tablas, {$prods} productos, {$users} usuarios.";`,
  ].join(' ');
  const initRes = spawnSync(phpBin, ['-r', initCode], { encoding: 'utf8' });
  if (initRes.status !== 0) {
    console.error('Error pre-inicializando SQLite:', initRes.stderr || initRes.stdout);
    process.exit(1);
  }
  console.log(`    ${initRes.stdout.trim()}`);
  // Limpiar posibles archivos auxiliares WAL/SHM para dejar un único bsp_store.sqlite limpio
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(sqliteTarget + suffix)) {
      fs.rmSync(sqliteTarget + suffix, { force: true });
    }
  }
} else {
  console.log(
    '    Aviso: PHP CLI no detectado localmente. La base SQLite se creará automáticamente en Hostinger al recibir la primera visita.'
  );
}

console.log('\n✅ ¡Paquete 100% Plug & Play para FileZilla generado en: dist-hostinger/ !');
console.log('   NO necesitas acceso a Hostinger hPanel ni a phpMyAdmin.');
console.log('   1. Abre FileZilla y entra a public_html/ (activa "Forzar mostrar archivos ocultos").');
console.log('   2. Arrastra TODO el contenido interno de dist-hostinger/ dentro de public_html/.');
console.log('   3. Abre https://bspstore.com.co/api/v1/health y luego inicia sesión como Admin.');
