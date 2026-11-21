<?php
declare(strict_types=1);

const SESSION_COOKIE_NAME = 'bsp_session';
const GUEST_CART_COOKIE_NAME = 'bsp_guest_cart';
const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const DUMMY_BCRYPT_HASH = '$2y$10$CwTycUXWue0Thq9StjUM0uJ8D0R6V1Z0K8p8q0v6Q9x5y0z1A2B3C';

function is_https_request(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https') {
        return true;
    }
    return ((int) ($_SERVER['SERVER_PORT'] ?? 80)) === 443;
}

function send_security_headers(bool $sensitive = false): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    if ($sensitive) {
        header('Cache-Control: no-store, no-cache, must-revalidate, private');
        header('X-Robots-Tag: noindex, nofollow');
    }
}

function extract_client_ip(): string
{
    $raw = (string) ($_SERVER['HTTP_CF_CONNECTING_IP']
        ?? $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['REMOTE_ADDR']
        ?? 'local');
    $first = trim(explode(',', $raw)[0] ?? '');
    $sanitized = substr((string) preg_replace('/[^a-fA-F0-9:.]/', '', $first), 0, 64);
    return $sanitized !== '' ? $sanitized : 'local';
}

function enforce_csrf_origin_check(string $path): void
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        return;
    }
    if (str_starts_with($path, '/webhooks/')) {
        return;
    }
    if (empty($_COOKIE[SESSION_COOKIE_NAME])) {
        return;
    }

    $secFetchSite = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($secFetchSite !== '' && !in_array($secFetchSite, ['same-origin', 'same-site', 'none'], true)) {
        throw new ApiException('CSRF_ORIGIN_MISMATCH', 'Solicitud bloqueada por política de seguridad de origen.', 403);
    }

    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
        $reqHost = strtolower(explode(':', (string) ($_SERVER['HTTP_HOST'] ?? ''))[0] ?? '');
        $appHost = strtolower((string) parse_url((string) (app_config()['app_url'] ?? ''), PHP_URL_HOST));
        if ($originHost === '' || ($originHost !== $reqHost && $originHost !== $appHost)) {
            throw new ApiException('CSRF_ORIGIN_MISMATCH', 'El origen de la solicitud no está autorizado.', 403);
        }
    }
}

function enforce_rate_limit(string $bucketKey, int $maxRequests = 15, int $windowSeconds = 60): void
{
    try {
        $pdo = db();
        $now = now_utc();

        // Limpieza ocasional para evitar crecimiento indefinido
        if (random_int(1, 40) === 1) {
            $del = $pdo->prepare('DELETE FROM rate_limits WHERE reset_at <= ?');
            $del->execute([$now]);
        }

        $stmt = $pdo->prepare('SELECT request_count, reset_at FROM rate_limits WHERE bucket_key = ? LIMIT 1');
        $stmt->execute([$bucketKey]);
        $row = $stmt->fetch();

        $nextReset = gmdate('Y-m-d H:i:s', time() + $windowSeconds);

        if (!$row) {
            $ins = $pdo->prepare('INSERT INTO rate_limits (bucket_key, request_count, reset_at) VALUES (?, 1, ?)');
            $ins->execute([$bucketKey, $nextReset]);
            return;
        }

        if ($row['reset_at'] <= $now) {
            $upd = $pdo->prepare('UPDATE rate_limits SET request_count = 1, reset_at = ? WHERE bucket_key = ?');
            $upd->execute([$nextReset, $bucketKey]);
            return;
        }

        if ((int) $row['request_count'] >= $maxRequests) {
            throw new ApiException(
                'RATE_LIMIT_EXCEEDED',
                'Has realizado demasiadas solicitudes en poco tiempo. Intenta nuevamente en un minuto.',
                429
            );
        }

        $inc = $pdo->prepare('UPDATE rate_limits SET request_count = request_count + 1 WHERE bucket_key = ?');
        $inc->execute([$bucketKey]);
    } catch (ApiException $e) {
        throw $e;
    } catch (Throwable $e) {
        // Si la tabla rate_limits aún no existe en una instalación parcial, registrar y no tumbar
        error_log('[BSP RateLimit Warning] ' . $e->getMessage());
    }
}

function hash_token(string $rawToken): string
{
    return hash('sha256', $rawToken);
}

function extract_session_token(): ?string
{
    $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (str_starts_with($auth, 'Bearer ')) {
        $bearer = trim(substr($auth, 7));
        if ($bearer !== '') {
            return $bearer;
        }
    }
    $cookie = trim((string) ($_COOKIE[SESSION_COOKIE_NAME] ?? ''));
    return $cookie !== '' ? $cookie : null;
}

function set_session_cookie(string $rawToken): void
{
    $maxAge = (int) (app_config()['session_max_age_seconds'] ?? 604800);
    setcookie(SESSION_COOKIE_NAME, $rawToken, [
        'expires' => time() + $maxAge,
        'path' => '/',
        'secure' => is_https_request(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_session_cookie(): void
{
    setcookie(SESSION_COOKIE_NAME, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => is_https_request(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function create_session_for_user(string $userId): string
{
    $rawToken = bin2hex(random_bytes(32));
    $tokenHash = hash_token($rawToken);
    $maxAge = (int) (app_config()['session_max_age_seconds'] ?? 604800);
    $expiresAt = gmdate('Y-m-d H:i:s', time() + $maxAge);
    $ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250);
    $ip = extract_client_ip();

    $stmt = db()->prepare(
        'INSERT INTO sessions (id, token_hash, user_id, user_agent, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([generate_id('ses'), $tokenHash, $userId, $ua, $ip, $expiresAt]);

    return $rawToken;
}

function format_user_dto(array $row): array
{
    $perms = json_decode((string) ($row['permissions'] ?? '[]'), true);
    $roleCode = (string) ($row['role_code'] ?? 'CUSTOMER');
    return [
        'id' => (string) $row['id'],
        'email' => (string) $row['email'],
        'name' => (string) $row['name'],
        'phone' => $row['phone'] !== null ? (string) $row['phone'] : null,
        'avatarUrl' => $row['avatar_url'] !== null ? (string) $row['avatar_url'] : null,
        'role' => $roleCode,
        'roleLabel' => role_label_es($roleCode),
        'permissions' => is_array($perms) ? $perms : [],
    ];
}

function get_session_user(?string $rawToken = null): ?array
{
    $token = $rawToken ?? extract_session_token();
    if (!$token || !preg_match('/^[a-f0-9]{32,128}$/i', $token)) {
        return null;
    }

    $tokenHash = hash_token($token);
    $stmt = db()->prepare(
        'SELECT u.id, u.email, u.name, u.phone, u.avatar_url, u.is_active,
                r.code AS role_code, r.permissions, s.id AS session_id, s.expires_at
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         INNER JOIN roles r ON r.id = u.role_id
         WHERE s.token_hash = ?
         LIMIT 1'
    );
    $stmt->execute([$tokenHash]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    if ($row['expires_at'] <= now_utc() || (int) $row['is_active'] !== 1) {
        $del = db()->prepare('DELETE FROM sessions WHERE id = ?');
        $del->execute([$row['session_id']]);
        return null;
    }

    return format_user_dto($row);
}

function require_auth(): array
{
    $user = get_session_user();
    if (!$user) {
        throw new ApiException('UNAUTHORIZED', 'Debes iniciar sesión para realizar esta acción.', 401);
    }
    return $user;
}

function require_admin(bool $strictAdminOnly = false): array
{
    $user = get_session_user();
    if (!$user) {
        throw new ApiException('UNAUTHORIZED', 'Debes iniciar sesión como administrador.', 401);
    }

    if ($strictAdminOnly) {
        if ($user['role'] !== 'ADMIN') {
            throw new ApiException(
                'FORBIDDEN_ADMIN_ONLY',
                'Esta acción requiere privilegios de Administrador.',
                403
            );
        }
    } elseif ($user['role'] !== 'ADMIN' && $user['role'] !== 'STAFF') {
        throw new ApiException(
            'FORBIDDEN_ADMIN_ONLY',
            'No cuentas con permisos administrativos para acceder a este recurso.',
            403
        );
    }

    return $user;
}

function write_audit_log(?string $actorId, string $action, string $entity, ?string $entityId = null, ?array $metadata = null): void
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, ip_address, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            generate_id('aud'),
            $actorId,
            $action,
            $entity,
            $entityId,
            extract_client_ip(),
            $metadata !== null ? json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        ]);
    } catch (Throwable $e) {
        error_log('[BSP AuditLog Warning] ' . $e->getMessage());
    }
}

// ==============================================================================
// VALIDACIÓN BINARIA DE MAGIC BYTES Y ALMACENAMIENTO SEGURO DE IMÁGENES
// ==============================================================================

function media_storage_root(): string
{
    return dirname(__DIR__) . '/storage/uploads';
}

function detect_image_mime_from_magic_bytes(string $binary): ?string
{
    if (strlen($binary) < 12) {
        return null;
    }

    $head = strtolower(ltrim(substr($binary, 0, 256)));
    if (
        str_starts_with($head, '<svg') ||
        str_starts_with($head, '<?xml') ||
        str_starts_with($head, '<!doctype') ||
        str_starts_with($head, '<html') ||
        str_starts_with($head, '<script')
    ) {
        return null;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (substr($binary, 0, 8) === "\x89PNG\r\n\x1a\n") {
        return 'image/png';
    }

    // JPEG: FF D8 FF
    if (substr($binary, 0, 3) === "\xff\xd8\xff") {
        return 'image/jpeg';
    }

    // WebP: RIFF....WEBP
    if (substr($binary, 0, 4) === 'RIFF' && substr($binary, 8, 4) === 'WEBP') {
        return 'image/webp';
    }

    return null;
}

function validate_image_upload_buffer(string $binary, ?string $declaredMime = null): array
{
    $len = strlen($binary);
    if ($len === 0) {
        throw new ApiException('EMPTY_FILE', 'El archivo de imagen está vacío.', 400);
    }
    if ($len > MAX_IMAGE_UPLOAD_BYTES) {
        throw new ApiException('FILE_TOO_LARGE', 'La imagen excede el tamaño máximo permitido de 2 MB.', 413);
    }

    $decl = strtolower(trim((string) $declaredMime));
    if ($decl !== '' && (str_contains($decl, 'svg') || str_contains($decl, 'html') || str_contains($decl, 'javascript'))) {
        throw new ApiException(
            'UNSUPPORTED_MEDIA_TYPE',
            'Por seguridad no se permiten archivos SVG, HTML ni scripts. Sube PNG, JPG o WebP.',
            415
        );
    }

    $detected = detect_image_mime_from_magic_bytes($binary);
    if ($detected === null) {
        throw new ApiException(
            'UNSUPPORTED_MEDIA_TYPE',
            'Formato de imagen no válido o firma binaria incompatible. Solo se permiten PNG, JPG o WebP reales.',
            415
        );
    }

    if ($decl !== '') {
        $canonical = $decl === 'image/jpg' ? 'image/jpeg' : $decl;
        if ($canonical !== 'application/octet-stream' && $canonical !== $detected) {
            throw new ApiException(
                'MIME_MISMATCH',
                'El tipo MIME declarado no coincide con el contenido real de la imagen.',
                415
            );
        }
    }

    $extMap = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];
    return ['mimeType' => $detected, 'ext' => $extMap[$detected]];
}

function save_uploaded_image(string $folder, string $binary, ?string $declaredMime = null): array
{
    if (!in_array($folder, ['avatars', 'catalog'], true)) {
        throw new ApiException('INVALID_MEDIA_FOLDER', 'Carpeta de almacenamiento no permitida.', 400);
    }

    $meta = validate_image_upload_buffer($binary, $declaredMime);
    $filename = generate_uuid_v4() . '.' . $meta['ext'];
    $folderDir = media_storage_root() . '/' . $folder;
    if (!is_dir($folderDir)) {
        mkdir($folderDir, 0755, true);
    }

    $target = $folderDir . '/' . $filename;
    if (file_put_contents($target, $binary, LOCK_EX) === false) {
        throw new ApiException('UPLOAD_WRITE_FAILED', 'No fue posible guardar la imagen en el servidor.', 500);
    }

    return [
        'url' => "/api/v1/media/{$folder}/{$filename}",
        'mimeType' => $meta['mimeType'],
        'sizeBytes' => strlen($binary),
        'filename' => $filename,
    ];
}

function read_managed_media_file(string $folder, string $filename): array
{
    if (!in_array($folder, ['avatars', 'catalog'], true)) {
        throw new ApiException('INVALID_MEDIA_PATH', 'Carpeta de media no permitida.', 400);
    }

    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/', $filename)) {
        throw new ApiException('INVALID_MEDIA_PATH', 'Nombre de archivo inválido.', 400);
    }

    $folderReal = realpath(media_storage_root() . '/' . $folder);
    if ($folderReal === false) {
        throw new ApiException('MEDIA_NOT_FOUND', 'Archivo multimedia no encontrado.', 404);
    }

    $fileReal = realpath($folderReal . DIRECTORY_SEPARATOR . $filename);
    if ($fileReal === false || !str_starts_with($fileReal, $folderReal . DIRECTORY_SEPARATOR) || !is_file($fileReal)) {
        throw new ApiException('MEDIA_NOT_FOUND', 'Archivo multimedia no encontrado.', 404);
    }

    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $mimeMap = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp'];
    $bytes = file_get_contents($fileReal);
    if ($bytes === false) {
        throw new ApiException('MEDIA_NOT_FOUND', 'No se pudo leer el archivo.', 404);
    }

    return ['bytes' => $bytes, 'mimeType' => $mimeMap[$ext] ?? 'application/octet-stream'];
}

function delete_managed_media_by_url(?string $url): void
{
    if (!$url || !preg_match('#^/api/v1/media/(avatars|catalog)/([0-9a-f-]{36}\.(?:png|jpg|webp))$#', $url, $m)) {
        return;
    }
    $path = media_storage_root() . '/' . $m[1] . '/' . $m[2];
    if (is_file($path)) {
        @unlink($path);
    }
}

function is_safe_media_url(string $rawUrl, bool $allowCatalogSvgPresets = false, bool $allowAnyTrustedHttps = false): bool
{
    $val = trim($rawUrl);
    if ($val === '' || strlen($val) > 450000) {
        return false;
    }
    if (str_contains($val, "\0") || str_contains($val, '\\') || str_contains($val, '..') || preg_match('/%2e|%2f|%5c|%00/i', $val)) {
        return false;
    }

    $lower = strtolower($val);
    foreach (['javascript:', 'vbscript:', 'file:', 'data:text/', 'data:image/svg'] as $bad) {
        if (str_starts_with($lower, $bad)) {
            return false;
        }
    }

    if (preg_match('#^/api/v1/media/(avatars|catalog)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$#', $val)) {
        return true;
    }

    if (str_starts_with($val, '/')) {
        if (str_starts_with($val, '//') || str_contains($val, '?') || str_contains($val, '#')) {
            return false;
        }
        $pattern = $allowCatalogSvgPresets
            ? '#^/(images|brand)/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|svg)$#i'
            : '#^/(images|brand)/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp)$#i';
        return (bool) preg_match($pattern, $val);
    }

    if (preg_match('#^data:(image/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$#', $val, $m)) {
        $declared = $m[1] === 'image/jpg' ? 'image/jpeg' : $m[1];
        $decoded = base64_decode($m[2], true);
        if ($decoded === false || strlen($decoded) > 350000) {
            return false;
        }
        return detect_image_mime_from_magic_bytes($decoded) === $declared;
    }

    $parts = parse_url($val);
    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
        return false;
    }
    if (str_ends_with(strtolower((string) ($parts['path'] ?? '')), '.svg')) {
        return false;
    }
    if ($allowAnyTrustedHttps) {
        return true;
    }

    $trustedHosts = [
        'lh3.googleusercontent.com',
        'lh4.googleusercontent.com',
        'lh5.googleusercontent.com',
        'lh6.googleusercontent.com',
    ];
    return in_array(strtolower((string) ($parts['host'] ?? '')), $trustedHosts, true);
}
