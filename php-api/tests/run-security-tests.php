<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/security.php';
require_once __DIR__ . '/../lib/mailer.php';

$passed = 0;
$failed = 0;

function check(string $name, callable $fn): void
{
    global $passed, $failed;
    try {
        $fn();
        echo "  [PASS] {$name}\n";
        $passed++;
    } catch (Throwable $e) {
        echo "  [FAIL] {$name}: {$e->getMessage()}\n";
        $failed++;
    }
}

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        throw new RuntimeException($msg);
    }
}

function assert_throws(callable $fn, string $msg): void
{
    try {
        $fn();
    } catch (Throwable) {
        return;
    }
    throw new RuntimeException("Expected exception: {$msg}");
}

echo "=== BSP Store PHP 8 + MySQL Security & Integrity Tests ===\n";

$png = "\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR";
$jpeg = "\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\xff\xd9";
$webp = "RIFF\x1a\x00\x00\x00WEBPVP8 ";

check('1. Magic bytes acepta PNG, JPEG y WebP auténticos', static function () use ($png, $jpeg, $webp): void {
    assert_true(detect_image_mime_from_magic_bytes($png) === 'image/png', 'PNG failed');
    assert_true(detect_image_mime_from_magic_bytes($jpeg) === 'image/jpeg', 'JPEG failed');
    assert_true(detect_image_mime_from_magic_bytes($webp) === 'image/webp', 'WebP failed');
});

check('2. Magic bytes rechaza SVG, HTML, JS, EXE y MIME spoofing', static function () use ($png): void {
    assert_throws(fn () => validate_image_upload_buffer('<svg onload=alert(1)></svg>', 'image/svg+xml'), 'SVG');
    assert_throws(fn () => validate_image_upload_buffer('<svg onload=alert(1)></svg>', 'image/png'), 'SVG as PNG');
    assert_throws(fn () => validate_image_upload_buffer('<!DOCTYPE html><script>alert(1)</script>', 'image/png'), 'HTML');
    assert_throws(fn () => validate_image_upload_buffer("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff", 'image/jpeg'), 'EXE');
    assert_throws(fn () => validate_image_upload_buffer($png, 'image/jpeg'), 'MIME mismatch');
});

check('3. Límite exacto de 2 MB en subida de imágenes', static function () use ($png): void {
    $exact = $png . str_repeat("\x00", MAX_IMAGE_UPLOAD_BYTES - strlen($png));
    $res = validate_image_upload_buffer($exact, 'image/png');
    assert_true($res['mimeType'] === 'image/png', 'Exact 2 MB should pass');

    $over = $exact . "\x00";
    assert_throws(fn () => validate_image_upload_buffer($over, 'image/png'), '2 MB + 1 should fail');
});

check('4. Ciclo UUID save/read/delete y bloqueo total de Path Traversal', static function () use ($webp): void {
    $saved = save_uploaded_image('avatars', $webp, 'image/webp');
    try {
        assert_true((bool) preg_match('#^/api/v1/media/avatars/[0-9a-f-]{36}\.webp$#', $saved['url']), 'UUID URL format');
        $loaded = read_managed_media_file('avatars', $saved['filename']);
        assert_true($loaded['mimeType'] === 'image/webp', 'Mime mismatch');
        assert_true($loaded['bytes'] === $webp, 'Bytes mismatch');
    } finally {
        delete_managed_media_by_url($saved['url']);
    }

    foreach (['../config.php', '../../.env', '..%2fconfig.php', "foo.png\0.txt", 'not-a-uuid.png'] as $vec) {
        assert_throws(fn () => read_managed_media_file('avatars', $vec), "Traversal {$vec}");
    }
    assert_throws(fn () => read_managed_media_file('../lib', 'bootstrap.php'), 'Folder traversal');
});

check('5. is_safe_media_url bloquea XSS, SVG, traversal y hosts no confiables', static function () use ($png): void {
    $bad = [
        'javascript:alert(1)',
        'vbscript:msgbox(1)',
        'data:text/html,<script>alert(1)</script>',
        'data:image/svg+xml;base64,' . base64_encode('<svg></svg>'),
        'data:image/png;base64,' . base64_encode('<svg></svg>'),
        'http://evil.example/a.png',
        'https://evil.example/tracker.png',
        '/images/../../config.php',
        '/images/%2e%2e/secret.png',
    ];
    foreach ($bad as $u) {
        assert_true(!is_safe_media_url($u, false, false), "Should reject {$u}");
    }

    assert_true(is_safe_media_url('/images/avatars/cyber-blue.png', false, false), 'Preset PNG');
    assert_true(is_safe_media_url('https://lh3.googleusercontent.com/a/photo.png', false, false), 'Google avatar');
    assert_true(is_safe_media_url('data:image/png;base64,' . base64_encode($png), false, false), 'Real PNG data URI');
});

check('6. Validación anti-HTML, roles en español y envíos locales Bucaramanga vs Nacional', static function (): void {
    assert_throws(fn () => assert_no_html('<script>alert(1)</script>', 'Nombre'), 'HTML tag');
    assert_true(role_label_es('CUSTOMER') === 'Usuario', 'CUSTOMER -> Usuario');
    assert_true(role_label_es('STAFF') === 'Empleado', 'STAFF -> Empleado');
    assert_true(role_label_es('ADMIN') === 'Admin', 'ADMIN -> Admin');
    assert_true(is_local_delivery_destination('Santander', 'Bucaramanga'), 'Bucaramanga local');
    assert_true(is_local_delivery_destination('Santander', 'Floridablanca'), 'Floridablanca local');
    assert_true(is_local_delivery_destination('Santander', 'Girón'), 'Girón local');
    assert_true(is_local_delivery_destination('Santander', 'Piedecuesta'), 'Piedecuesta local');
    assert_true(!is_local_delivery_destination('Antioquia', 'Medellín'), 'Medellín nacional');
    assert_true(!is_local_delivery_destination('Santander', 'Barrancabermeja'), 'Barrancabermeja nacional');
});

check('7. Integridad de bsp_store_mysql.sql (28 tablas y hashes bcrypt verificados)', static function (): void {
    $sql = file_get_contents(__DIR__ . '/../database/bsp_store_mysql.sql');
    assert_true(is_string($sql) && strlen($sql) > 5000, 'SQL missing');
    preg_match_all('/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/i', $sql, $matches);
    assert_true(count($matches[1]) === 28, 'Expected 28 tables, found ' . count($matches[1]));

    preg_match("/'admin@bspstore\.com\.co',\s*'([^']+)'/", $sql, $mAdmin);
    preg_match("/'cliente@bspstore\.com\.co',\s*'([^']+)'/", $sql, $mCli);
    assert_true(!empty($mAdmin[1]) && password_verify('BspAdmin2026*', $mAdmin[1]), 'Admin bcrypt hash invalid');
    assert_true(!empty($mCli[1]) && password_verify('BspCliente2026*', $mCli[1]), 'Cliente bcrypt hash invalid');
});

echo "\nResultado PHP: {$passed} aprobados, {$failed} fallidos.\n";
exit($failed > 0 ? 1 : 0);
