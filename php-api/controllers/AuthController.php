<?php
declare(strict_types=1);

class AuthController
{
    public static function register(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("auth:register:{$ip}", 10, 60);

        $body = read_json_body();
        $name = assert_no_html((string) ($body['name'] ?? ''), 'El nombre');
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $phone = isset($body['phone']) ? trim((string) $body['phone']) : null;
        $acceptTerms = array_key_exists('acceptTerms', $body) ? (bool) $body['acceptTerms'] : true;
        $acceptPrivacy = array_key_exists('acceptPrivacyPolicy', $body) ? (bool) $body['acceptPrivacyPolicy'] : true;

        if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
            throw new ApiException('VALIDATION_ERROR', 'El nombre debe tener entre 2 y 100 caracteres.', 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ApiException('VALIDATION_ERROR', 'Ingresa un correo electrónico válido.', 422);
        }
        if (strlen($password) < 8 || strlen($password) > 72 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
            throw new ApiException('VALIDATION_ERROR', 'La contraseña debe tener mínimo 8 caracteres, letras y números.', 422);
        }
        if ($phone !== null && $phone !== '' && !preg_match('/^[0-9+\s()-]{7,20}$/', $phone)) {
            throw new ApiException('VALIDATION_ERROR', 'Ingresa un teléfono válido.', 422);
        }
        if (!$acceptTerms) {
            throw new ApiException('VALIDATION_ERROR', 'Debes aceptar los Términos y Condiciones Comerciales (Ley 1480 de 2011).', 422);
        }
        if (!$acceptPrivacy) {
            throw new ApiException('VALIDATION_ERROR', 'Debes autorizar el Tratamiento de Datos Personales (Ley 1581 de 2012).', 422);
        }

        $pdo = db();
        $exists = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $exists->execute([$email]);
        if ($exists->fetch()) {
            throw new ApiException('EMAIL_ALREADY_REGISTERED', 'Ya existe una cuenta registrada con este correo electrónico.', 409);
        }

        $roleRow = $pdo->query("SELECT id, code, permissions FROM roles WHERE code = 'CUSTOMER' LIMIT 1")->fetch();
        if (!$roleRow) {
            throw new ApiException('ROLE_MISSING', 'Rol CUSTOMER no configurado en la base de datos.', 500);
        }

        $userId = generate_id('usr');
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

        $ins = $pdo->prepare(
            'INSERT INTO users (id, email, password_hash, name, phone, role_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)'
        );
        $ins->execute([$userId, $email, $hash, $name, $phone ?: null, $roleRow['id']]);

        write_audit_log($userId, 'AUTH_REGISTER', 'User', $userId, [
            'acceptedTermsLey1480' => true,
            'acceptedPrivacyLey1581' => true,
            'policyVersion' => 'v2026.1-CO',
        ]);

        $sessionToken = create_session_for_user($userId);
        set_session_cookie($sessionToken);

        $userDto = format_user_dto([
            'id' => $userId,
            'email' => $email,
            'name' => $name,
            'phone' => $phone ?: null,
            'avatar_url' => null,
            'role_code' => $roleRow['code'],
            'permissions' => $roleRow['permissions'],
        ]);

        $isMobile = strtolower((string) ($_SERVER['HTTP_X_CLIENT_PLATFORM'] ?? '')) === 'flutter';
        api_success($isMobile ? ['user' => $userDto, 'sessionToken' => $sessionToken] : ['user' => $userDto], 201);
    }

    public static function login(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("auth:login:{$ip}", 12, 60);

        $body = read_json_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            throw new ApiException('VALIDATION_ERROR', 'Ingresa correo electrónico y contraseña válidos.', 422);
        }
        enforce_rate_limit("auth:login:email:{$email}", 10, 300);

        $stmt = db()->prepare(
            'SELECT u.id, u.email, u.password_hash, u.name, u.phone, u.avatar_url, u.is_active,
                    r.code AS role_code, r.permissions
             FROM users u
             INNER JOIN roles r ON r.id = u.role_id
             WHERE u.email = ?
             LIMIT 1'
        );
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if (!$row || empty($row['password_hash'])) {
            password_verify($password, DUMMY_BCRYPT_HASH);
            throw new ApiException('INVALID_CREDENTIALS', 'Correo electrónico o contraseña incorrectos.', 401);
        }

        if (!password_verify($password, (string) $row['password_hash'])) {
            throw new ApiException('INVALID_CREDENTIALS', 'Correo electrónico o contraseña incorrectos.', 401);
        }

        if ((int) $row['is_active'] !== 1) {
            throw new ApiException('ACCOUNT_DISABLED', 'Esta cuenta se encuentra desactivada.', 403);
        }

        write_audit_log((string) $row['id'], 'AUTH_LOGIN_PASSWORD', 'User', (string) $row['id']);

        $sessionToken = create_session_for_user((string) $row['id']);
        set_session_cookie($sessionToken);

        $userDto = format_user_dto($row);
        $isMobile = strtolower((string) ($_SERVER['HTTP_X_CLIENT_PLATFORM'] ?? '')) === 'flutter';
        api_success($isMobile ? ['user' => $userDto, 'sessionToken' => $sessionToken] : ['user' => $userDto]);
    }

    public static function logout(): never
    {
        $token = extract_session_token();
        if ($token) {
            $stmt = db()->prepare('DELETE FROM sessions WHERE token_hash = ?');
            $stmt->execute([hash_token($token)]);
        }
        clear_session_cookie();
        api_success(['loggedOut' => true]);
    }

    public static function meGet(): never
    {
        $user = get_session_user();
        if (!$user) {
            api_success(['authenticated' => false, 'user' => null]);
        }

        $pdo = db();
        $addrStmt = $pdo->prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC');
        $addrStmt->execute([$user['id']]);
        $addresses = array_map(static fn (array $a): array => [
            'id' => $a['id'],
            'label' => $a['label'],
            'recipientName' => $a['recipient_name'],
            'phone' => $a['phone'],
            'department' => $a['department'],
            'city' => $a['city'],
            'neighborhood' => $a['neighborhood'],
            'streetAddress' => $a['street_address'],
            'additionalInfo' => $a['additional_info'],
            'isDefault' => (bool) $a['is_default'],
        ], $addrStmt->fetchAll());

        $oauthStmt = $pdo->prepare('SELECT provider FROM oauth_accounts WHERE user_id = ?');
        $oauthStmt->execute([$user['id']]);
        $providers = array_map(static fn (array $r): string => (string) $r['provider'], $oauthStmt->fetchAll());

        api_success([
            'authenticated' => true,
            'user' => array_merge($user, [
                'addresses' => $addresses,
                'connectedProviders' => $providers,
            ]),
        ]);
    }

    public static function mePatch(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("auth:me:patch:{$ip}", 25, 60);
        $sessionUser = require_auth();

        $body = read_json_body();
        $sets = [];
        $params = [];

        if (array_key_exists('name', $body)) {
            $name = assert_no_html((string) $body['name'], 'El nombre');
            if (mb_strlen($name) < 2 || mb_strlen($name) > 120) {
                throw new ApiException('VALIDATION_ERROR', 'Ingresa tu nombre completo (2 a 120 caracteres).', 422);
            }
            $sets[] = 'name = ?';
            $params[] = $name;
        }
        if (array_key_exists('phone', $body)) {
            $phone = $body['phone'] !== null ? trim((string) $body['phone']) : '';
            if ($phone !== '' && !preg_match('/^[0-9+\s()-]{1,30}$/', $phone)) {
                throw new ApiException('VALIDATION_ERROR', 'Ingresa un teléfono válido.', 422);
            }
            $sets[] = 'phone = ?';
            $params[] = $phone !== '' ? $phone : null;
        }
        if (array_key_exists('documentType', $body)) {
            $docType = $body['documentType'] !== null ? assert_no_html((string) $body['documentType'], 'Tipo de documento') : '';
            $sets[] = 'document_type = ?';
            $params[] = $docType !== '' ? substr($docType, 0, 20) : null;
        }
        if (array_key_exists('documentNumber', $body)) {
            $docNum = $body['documentNumber'] !== null ? trim((string) $body['documentNumber']) : '';
            if ($docNum !== '' && !preg_match('/^[a-zA-Z0-9.-]{1,40}$/', $docNum)) {
                throw new ApiException('VALIDATION_ERROR', 'Número de documento inválido.', 422);
            }
            $sets[] = 'document_number = ?';
            $params[] = $docNum !== '' ? $docNum : null;
        }
        if (array_key_exists('avatarUrl', $body)) {
            $avatar = $body['avatarUrl'] !== null ? trim((string) $body['avatarUrl']) : '';
            if ($avatar !== '' && !is_safe_media_url($avatar, false, false)) {
                throw new ApiException(
                    'VALIDATION_ERROR',
                    'Formato de imagen no permitido. Usa únicamente fotos JPG, PNG o WebP válidas.',
                    422
                );
            }
            $sets[] = 'avatar_url = ?';
            $params[] = $avatar !== '' ? $avatar : null;
        }

        if ($sets) {
            $params[] = $sessionUser['id'];
            $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?';
            db()->prepare($sql)->execute($params);
        }

        write_audit_log($sessionUser['id'], 'USER_PROFILE_UPDATED', 'User', $sessionUser['id'], [
            'avatarUpdated' => array_key_exists('avatarUrl', $body),
            'law' => 'Ley 1581 de 2012',
        ]);

        $stmt = db()->prepare(
            'SELECT u.id, u.email, u.name, u.phone, u.avatar_url, r.code AS role_code, r.permissions
             FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1'
        );
        $stmt->execute([$sessionUser['id']]);
        api_success(['user' => format_user_dto($stmt->fetch())]);
    }

    public static function avatarUpload(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("avatar:upload:{$ip}", 15, 900);
        $user = require_auth();

        if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ApiException('MISSING_FILE', 'Adjunta un archivo de imagen válido en el campo "file".', 400);
        }

        $tmpPath = (string) $_FILES['file']['tmp_name'];
        $declaredType = (string) ($_FILES['file']['type'] ?? '');
        $bytes = file_get_contents($tmpPath);
        if ($bytes === false) {
            throw new ApiException('EMPTY_FILE', 'No se pudo leer el archivo subido.', 400);
        }

        $saved = save_uploaded_image('avatars', $bytes, $declaredType);

        $prevStmt = db()->prepare('SELECT avatar_url FROM users WHERE id = ? LIMIT 1');
        $prevStmt->execute([$user['id']]);
        $prevUrl = $prevStmt->fetchColumn();

        db()->prepare('UPDATE users SET avatar_url = ? WHERE id = ?')->execute([$saved['url'], $user['id']]);

        if (is_string($prevUrl) && $prevUrl !== $saved['url']) {
            delete_managed_media_by_url($prevUrl);
        }

        write_audit_log($user['id'], 'USER_AVATAR_UPLOADED', 'User', $user['id'], [
            'mimeType' => $saved['mimeType'],
            'sizeBytes' => $saved['sizeBytes'],
            'storageUrl' => $saved['url'],
        ]);

        api_success(['avatarUrl' => $saved['url']], 201);
    }

    public static function avatarDelete(): never
    {
        $user = require_auth();
        $prevStmt = db()->prepare('SELECT avatar_url FROM users WHERE id = ? LIMIT 1');
        $prevStmt->execute([$user['id']]);
        $prevUrl = $prevStmt->fetchColumn();

        db()->prepare('UPDATE users SET avatar_url = NULL WHERE id = ?')->execute([$user['id']]);
        if (is_string($prevUrl)) {
            delete_managed_media_by_url($prevUrl);
        }

        api_success(['avatarUrl' => null]);
    }

    public static function passwordResetRequest(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("auth:reset-request:{$ip}", 8, 60);

        $body = read_json_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ApiException('VALIDATION_ERROR', 'Ingresa un correo electrónico válido.', 422);
        }
        enforce_rate_limit("auth:reset-request:email:{$email}", 5, 900);

        $pdo = db();
        $stmt = $pdo->prepare('SELECT id, is_active FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user && (int) $user['is_active'] === 1) {
            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash_token($rawToken);
            $now = now_utc();
            $expiresAt = gmdate('Y-m-d H:i:s', time() + 1800);

            $pdo->beginTransaction();
            try {
                $pdo->prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL')
                    ->execute([$now, $user['id']]);
                $pdo->prepare('INSERT INTO password_reset_tokens (id, token_hash, user_id, expires_at) VALUES (?, ?, ?, ?)')
                    ->execute([generate_id('rst'), $tokenHash, $user['id'], $expiresAt]);
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }

            write_audit_log((string) $user['id'], 'AUTH_PASSWORD_RESET_REQUESTED', 'User', (string) $user['id']);
            send_password_reset_email($email, $rawToken);
        }

        api_success([
            'message' => 'Si el correo existe en nuestro sistema, hemos enviado las instrucciones para restablecer tu contraseña.',
        ]);
    }

    public static function passwordResetConfirm(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("auth:reset-confirm:{$ip}", 8, 60);

        $body = read_json_body();
        $token = trim((string) ($body['token'] ?? ''));
        $newPassword = (string) ($body['newPassword'] ?? '');

        if (strlen($token) < 16) {
            throw new ApiException('VALIDATION_ERROR', 'Token de recuperación inválido.', 422);
        }
        if (strlen($newPassword) < 8 || strlen($newPassword) > 72 || !preg_match('/[A-Za-z]/', $newPassword) || !preg_match('/[0-9]/', $newPassword)) {
            throw new ApiException('VALIDATION_ERROR', 'La nueva contraseña debe tener mínimo 8 caracteres, letras y números.', 422);
        }

        $pdo = db();
        $now = now_utc();
        $tokenHash = hash_token($token);

        $stmt = $pdo->prepare('SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1');
        $stmt->execute([$tokenHash]);
        $rec = $stmt->fetch();

        if (!$rec || $rec['used_at'] !== null || $rec['expires_at'] <= $now) {
            throw new ApiException('INVALID_OR_EXPIRED_TOKEN', 'El enlace de recuperación es inválido o ha expirado.', 400);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);

        $pdo->beginTransaction();
        try {
            $claim = $pdo->prepare(
                'UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?'
            );
            $claim->execute([$now, $rec['id'], $now]);
            if ($claim->rowCount() !== 1) {
                throw new ApiException('INVALID_OR_EXPIRED_TOKEN', 'El enlace de recuperación ya fue utilizado o expiró.', 400);
            }
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$newHash, $rec['user_id']]);
            $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$rec['user_id']]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        write_audit_log((string) $rec['user_id'], 'AUTH_PASSWORD_RESET_COMPLETED', 'User', (string) $rec['user_id']);
        api_success(['message' => 'Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión.']);
    }

    public static function googleConfigGet(): never
    {
        $g = app_config()['google'] ?? [];
        $clientId = trim((string) ($g['client_id'] ?? ''));
        $clientSecret = trim((string) ($g['client_secret'] ?? ''));

        if ($clientId === '' || $clientSecret === '') {
            api_success(['provider' => 'google', 'oauthConfigured' => false, 'authorizeUrl' => null]);
        }

        $appUrl = rtrim((string) (app_config()['app_url'] ?? 'https://bspstore.com.co'), '/');
        $redirectUri = $appUrl . '/api/v1/auth/google/callback';
        $state = bin2hex(random_bytes(24));

        setcookie('bsp_oauth_state', $state, [
            'expires' => time() + 600,
            'path' => '/api/v1/auth/google',
            'secure' => is_https_request(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        $authorizeUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'prompt' => 'select_account',
        ]);

        api_success(['provider' => 'google', 'oauthConfigured' => true, 'authorizeUrl' => $authorizeUrl]);
    }

    public static function googleCallback(): never
    {
        $redirectErr = static function (string $reason): never {
            setcookie('bsp_oauth_state', '', ['expires' => time() - 3600, 'path' => '/api/v1/auth/google']);
            header('Location: /cuenta/?oauth_error=' . urlencode($reason), true, 302);
            exit;
        };

        $g = app_config()['google'] ?? [];
        $clientId = trim((string) ($g['client_id'] ?? ''));
        $clientSecret = trim((string) ($g['client_secret'] ?? ''));
        if ($clientId === '' || $clientSecret === '') {
            $redirectErr('not_configured');
        }
        if (!empty($_GET['error'])) {
            $redirectErr('cancelled');
        }

        $code = trim((string) ($_GET['code'] ?? ''));
        $state = trim((string) ($_GET['state'] ?? ''));
        $expectedState = trim((string) ($_COOKIE['bsp_oauth_state'] ?? ''));
        if ($code === '' || $state === '' || $expectedState === '' || !hash_equals($expectedState, $state)) {
            $redirectErr('invalid_state');
        }

        $appUrl = rtrim((string) (app_config()['app_url'] ?? 'https://bspstore.com.co'), '/');
        $redirectUri = $appUrl . '/api/v1/auth/google/callback';

        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_POSTFIELDS => http_build_query([
                'code' => $code,
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'redirect_uri' => $redirectUri,
                'grant_type' => 'authorization_code',
            ]),
        ]);
        $tokenBody = curl_exec($ch);
        $tokenCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($tokenBody === false || $tokenCode !== 200) {
            $redirectErr('token_exchange_failed');
        }
        $tokenJson = json_decode($tokenBody, true);
        $idToken = trim((string) ($tokenJson['id_token'] ?? ''));
        if ($idToken === '') {
            $redirectErr('missing_id_token');
        }

        $infoBody = @file_get_contents('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
        $payload = is_string($infoBody) ? json_decode($infoBody, true) : null;
        if (!is_array($payload)) {
            $redirectErr('token_verification_failed');
        }

        $emailVerified = ($payload['email_verified'] ?? false) === true || ($payload['email_verified'] ?? '') === 'true';
        $iss = (string) ($payload['iss'] ?? '');
        $aud = (string) ($payload['aud'] ?? '');
        $exp = (int) ($payload['exp'] ?? 0);
        $sub = trim((string) ($payload['sub'] ?? ''));
        $email = strtolower(trim((string) ($payload['email'] ?? '')));

        if (
            $sub === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$emailVerified ||
            $aud !== $clientId || !in_array($iss, ['accounts.google.com', 'https://accounts.google.com'], true) ||
            $exp <= time()
        ) {
            $redirectErr('invalid_identity');
        }

        $pdo = db();
        $stmt = $pdo->prepare(
            'SELECT u.id, u.is_active, r.code AS role_code FROM oauth_accounts oa
             INNER JOIN users u ON u.id = oa.user_id
             INNER JOIN roles r ON r.id = u.role_id
             WHERE oa.provider = ? AND oa.provider_account_id = ? LIMIT 1'
        );
        $stmt->execute(['google', $sub]);
        $linked = $stmt->fetch();

        $userId = null;
        if ($linked) {
            if ((int) $linked['is_active'] !== 1) {
                $redirectErr('account_disabled');
            }
            $userId = (string) $linked['id'];
        } else {
            $byEmail = $pdo->prepare(
                'SELECT u.id, u.is_active, r.code AS role_code FROM users u
                 INNER JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1'
            );
            $byEmail->execute([$email]);
            $existing = $byEmail->fetch();

            if ($existing) {
                if (in_array($existing['role_code'], ['ADMIN', 'STAFF'], true)) {
                    $redirectErr('admin_password_only');
                }
                if ((int) $existing['is_active'] !== 1) {
                    $redirectErr('account_disabled');
                }
                $userId = (string) $existing['id'];
            } else {
                $roleId = (string) $pdo->query("SELECT id FROM roles WHERE code = 'CUSTOMER' LIMIT 1")->fetchColumn();
                $userId = generate_id('usr');
                $name = substr(trim((string) ($payload['name'] ?? explode('@', $email)[0])), 0, 100);
                $pic = isset($payload['picture']) && is_safe_media_url((string) $payload['picture'], false, false)
                    ? (string) $payload['picture']
                    : null;
                $pdo->prepare(
                    'INSERT INTO users (id, email, name, avatar_url, role_id, is_active, email_verified)
                     VALUES (?, ?, ?, ?, ?, 1, ?)'
                )->execute([$userId, $email, $name ?: 'Cliente BSP', $pic, $roleId, now_utc()]);
            }

            $pdo->prepare(
                'INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)'
            )->execute([generate_id('oau'), $userId, 'google', $sub]);
        }

        write_audit_log($userId, 'AUTH_LOGIN_GOOGLE', 'User', $userId);
        $sessionToken = create_session_for_user($userId);
        set_session_cookie($sessionToken);
        setcookie('bsp_oauth_state', '', ['expires' => time() - 3600, 'path' => '/api/v1/auth/google']);

        header('Location: /cuenta/', true, 302);
        exit;
    }
}
