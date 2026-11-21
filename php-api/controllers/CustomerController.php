<?php
declare(strict_types=1);

class CustomerController
{
    private static function resolveGuestCartToken(): array
    {
        $fromCookie = trim((string) ($_COOKIE[GUEST_CART_COOKIE_NAME] ?? ''));
        if ($fromCookie !== '' && preg_match('/^[a-f0-9]{32,64}$/i', $fromCookie)) {
            return ['token' => $fromCookie, 'isNew' => false];
        }
        $token = bin2hex(random_bytes(24));
        setcookie(GUEST_CART_COOKIE_NAME, $token, [
            'expires' => time() + 60 * 60 * 24 * 14,
            'path' => '/',
            'secure' => is_https_request(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        return ['token' => $token, 'isNew' => true];
    }

    private static function getOrCreateCart(?string $userId, ?string $guestToken): array
    {
        $pdo = db();
        if ($userId) {
            $stmt = $pdo->prepare('SELECT id FROM carts WHERE user_id = ? LIMIT 1');
            $stmt->execute([$userId]);
            $cartId = $stmt->fetchColumn();
            if (!$cartId) {
                $cartId = generate_id('crt');
                $pdo->prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)')->execute([$cartId, $userId]);
            }
        } else {
            $stmt = $pdo->prepare('SELECT id FROM carts WHERE guest_token = ? LIMIT 1');
            $stmt->execute([$guestToken]);
            $cartId = $stmt->fetchColumn();
            if (!$cartId) {
                $cartId = generate_id('crt');
                $pdo->prepare('INSERT INTO carts (id, guest_token) VALUES (?, ?)')->execute([$cartId, $guestToken]);
            }
        }

        $itemsStmt = $pdo->prepare(
            'SELECT ci.id, ci.quantity, ci.variant_id,
                    p.id AS product_id, p.legacy_id, p.slug, p.name, p.price, p.sku,
                    pv.price_override, pv.option_value AS variant_label
             FROM cart_items ci
             INNER JOIN products p ON p.id = ci.product_id
             LEFT JOIN product_variants pv ON pv.id = ci.variant_id
             WHERE ci.cart_id = ?'
        );
        $itemsStmt->execute([$cartId]);
        $rows = $itemsStmt->fetchAll();

        $items = [];
        $subtotal = 0;
        $totalCount = 0;
        foreach ($rows as $r) {
            $unitPrice = $r['price_override'] !== null ? (int) $r['price_override'] : (int) $r['price'];
            $qty = (int) $r['quantity'];
            $line = $unitPrice * $qty;
            $subtotal += $line;
            $totalCount += $qty;
            $items[] = [
                'id' => (string) $r['id'],
                'productId' => (string) $r['product_id'],
                'legacyId' => $r['legacy_id'] !== null ? (int) $r['legacy_id'] : null,
                'slug' => (string) $r['slug'],
                'name' => (string) $r['name'],
                'sku' => (string) $r['sku'],
                'variantId' => $r['variant_id'] !== null ? (string) $r['variant_id'] : null,
                'variantLabel' => $r['variant_label'] !== null ? (string) $r['variant_label'] : null,
                'unitPrice' => $unitPrice,
                'quantity' => $qty,
                'lineTotal' => $line,
            ];
        }

        return [
            'cartId' => (string) $cartId,
            'items' => $items,
            'totalCount' => $totalCount,
            'subtotalCop' => $subtotal,
        ];
    }

    public static function cartGet(): never
    {
        $user = get_session_user();
        $guest = $user ? null : self::resolveGuestCartToken();
        api_success(self::getOrCreateCart($user['id'] ?? null, $guest['token'] ?? null));
    }

    public static function cartPost(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("cart:post:{$ip}", 60, 60);
        $user = get_session_user();
        $guest = $user ? null : self::resolveGuestCartToken();
        $body = read_json_body();

        $prodRef = (string) ($body['productIdOrLegacyId'] ?? '');
        $variantId = isset($body['variantId']) && trim((string) $body['variantId']) !== ''
            ? trim((string) $body['variantId'])
            : null;
        $quantity = (int) ($body['quantity'] ?? 0);

        if ($prodRef === '' || $quantity < 0 || $quantity > 20) {
            throw new ApiException('VALIDATION_ERROR', 'Datos de carrito inválidos.', 422);
        }

        $cart = self::getOrCreateCart($user['id'] ?? null, $guest['token'] ?? null);
        $pdo = db();

        $isNum = ctype_digit($prodRef) && (int) $prodRef > 0;
        $pStmt = $pdo->prepare(
            'SELECT p.id, p.name, COALESCE(i.quantity_on_hand, 0) AS on_hand, COALESCE(i.quantity_reserved, 0) AS reserved
             FROM products p LEFT JOIN inventories i ON i.product_id = p.id
             WHERE p.is_active = 1 AND (' . ($isNum ? 'p.legacy_id = ? OR ' : '') . 'p.id = ?) LIMIT 1'
        );
        $pStmt->execute($isNum ? [(int) $prodRef, $prodRef] : [$prodRef]);
        $prod = $pStmt->fetch();
        if (!$prod) {
            throw new ApiException('PRODUCT_NOT_FOUND', 'El producto no existe o no está disponible.', 404);
        }

        if ($variantId !== null) {
            $vCheck = $pdo->prepare('SELECT id FROM product_variants WHERE id = ? AND product_id = ? AND is_active = 1 LIMIT 1');
            $vCheck->execute([$variantId, $prod['id']]);
            if (!$vCheck->fetch()) {
                throw new ApiException('INVALID_VARIANT', 'La variante seleccionada no pertenece a este producto.', 400);
            }
        }

        $avail = max(0, (int) $prod['on_hand'] - (int) $prod['reserved']);
        if ($quantity > $avail) {
            throw new ApiException('INSUFFICIENT_STOCK', "Solo quedan {$avail} unidades disponibles de {$prod['name']}.", 409);
        }

        $exStmt = $variantId === null
            ? $pdo->prepare('SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id IS NULL LIMIT 1')
            : $pdo->prepare('SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id = ? LIMIT 1');
        $exStmt->execute($variantId === null ? [$cart['cartId'], $prod['id']] : [$cart['cartId'], $prod['id'], $variantId]);
        $existingId = $exStmt->fetchColumn();

        if ($quantity === 0) {
            if ($existingId) {
                $pdo->prepare('DELETE FROM cart_items WHERE id = ?')->execute([$existingId]);
            }
        } elseif ($existingId) {
            $pdo->prepare('UPDATE cart_items SET quantity = ? WHERE id = ?')->execute([$quantity, $existingId]);
        } else {
            $pdo->prepare('INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?, ?)')
                ->execute([generate_id('cit'), $cart['cartId'], $prod['id'], $variantId, $quantity]);
        }

        api_success(self::getOrCreateCart($user['id'] ?? null, $guest['token'] ?? null));
    }

    public static function favoritesGet(): never
    {
        $user = require_auth();
        $stmt = db()->prepare(
            'SELECT p.legacy_id, p.id FROM favorites f INNER JOIN products p ON p.id = f.product_id WHERE f.user_id = ?'
        );
        $stmt->execute([$user['id']]);
        $ids = [];
        foreach ($stmt->fetchAll() as $r) {
            if ($r['legacy_id'] !== null) {
                $ids[] = (int) $r['legacy_id'];
            }
        }
        api_success(['favorites' => $ids]);
    }

    public static function favoritesPost(): never
    {
        $user = require_auth();
        $body = read_json_body();
        $ref = (string) ($body['productIdOrLegacyId'] ?? $body['productId'] ?? '');
        if ($ref === '') {
            throw new ApiException('VALIDATION_ERROR', 'Producto requerido.', 422);
        }

        $pdo = db();
        $isNum = ctype_digit($ref) && (int) $ref > 0;
        $pStmt = $pdo->prepare('SELECT id, legacy_id FROM products WHERE ' . ($isNum ? 'legacy_id = ? OR ' : '') . 'id = ? LIMIT 1');
        $pStmt->execute($isNum ? [(int) $ref, $ref] : [$ref]);
        $prod = $pStmt->fetch();
        if (!$prod) {
            throw new ApiException('PRODUCT_NOT_FOUND', 'Producto no encontrado.', 404);
        }

        $ex = $pdo->prepare('SELECT id FROM favorites WHERE user_id = ? AND product_id = ? LIMIT 1');
        $ex->execute([$user['id'], $prod['id']]);
        $favId = $ex->fetchColumn();

        if ($favId) {
            $pdo->prepare('DELETE FROM favorites WHERE id = ?')->execute([$favId]);
            $isFavorite = false;
        } else {
            $pdo->prepare('INSERT INTO favorites (id, user_id, product_id) VALUES (?, ?, ?)')
                ->execute([generate_id('fav'), $user['id'], $prod['id']]);
            $isFavorite = true;
        }

        $stmt = $pdo->prepare('SELECT p.legacy_id FROM favorites f INNER JOIN products p ON p.id = f.product_id WHERE f.user_id = ?');
        $stmt->execute([$user['id']]);
        $all = array_values(array_filter(array_map(static fn ($r) => $r['legacy_id'] !== null ? (int) $r['legacy_id'] : null, $stmt->fetchAll())));

        api_success(['isFavorite' => $isFavorite, 'favorites' => $all]);
    }

    private static function formatAddress(array $a): array
    {
        return [
            'id' => (string) $a['id'],
            'label' => (string) $a['label'],
            'recipientName' => (string) $a['recipient_name'],
            'phone' => (string) $a['phone'],
            'department' => (string) $a['department'],
            'city' => (string) $a['city'],
            'neighborhood' => $a['neighborhood'] !== null ? (string) $a['neighborhood'] : null,
            'streetAddress' => (string) $a['street_address'],
            'additionalInfo' => $a['additional_info'] !== null ? (string) $a['additional_info'] : null,
            'isDefault' => (bool) $a['is_default'],
        ];
    }

    public static function addressesGet(): never
    {
        $user = require_auth();
        $stmt = db()->prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC');
        $stmt->execute([$user['id']]);
        api_success(['addresses' => array_map([self::class, 'formatAddress'], $stmt->fetchAll())]);
    }

    public static function addressesPost(): never
    {
        $user = require_auth();
        $b = read_json_body();
        $label = assert_no_html((string) ($b['label'] ?? 'Casa'), 'Etiqueta');
        $recipient = assert_no_html((string) ($b['recipientName'] ?? ''), 'Destinatario');
        $phone = trim((string) ($b['phone'] ?? ''));
        $dept = assert_no_html((string) ($b['department'] ?? ''), 'Departamento');
        $city = assert_no_html((string) ($b['city'] ?? ''), 'Ciudad');
        $street = assert_no_html((string) ($b['streetAddress'] ?? ''), 'Dirección');
        $neigh = isset($b['neighborhood']) ? assert_no_html((string) $b['neighborhood'], 'Barrio') : null;
        $info = isset($b['additionalInfo']) ? assert_no_html((string) $b['additionalInfo'], 'Información adicional') : null;
        $isDefault = (bool) ($b['isDefault'] ?? false);

        if (mb_strlen($recipient) < 2 || !preg_match('/^[0-9+\s()-]{7,20}$/', $phone) || mb_strlen($dept) < 2 || mb_strlen($city) < 2 || mb_strlen($street) < 5) {
            throw new ApiException('VALIDATION_ERROR', 'Completa todos los campos obligatorios de la dirección.', 422);
        }

        $pdo = db();
        if ($isDefault) {
            $pdo->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?')->execute([$user['id']]);
        }

        $id = generate_id('adr');
        $pdo->prepare(
            'INSERT INTO addresses (id, user_id, label, recipient_name, phone, department, city, neighborhood, street_address, additional_info, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([$id, $user['id'], $label ?: 'Casa', $recipient, $phone, $dept, $city, $neigh ?: null, $street, $info ?: null, $isDefault ? 1 : 0]);

        $stmt = $pdo->prepare('SELECT * FROM addresses WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        api_success(['address' => self::formatAddress($stmt->fetch())], 201);
    }

    public static function addressUpdate(string $addressId): never
    {
        $user = require_auth();
        $pdo = db();
        $stmt = $pdo->prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1');
        $stmt->execute([$addressId, $user['id']]);
        $existing = $stmt->fetch();
        if (!$existing) {
            throw new ApiException('NOT_FOUND', 'Dirección no encontrada.', 404);
        }

        $b = read_json_body();
        $label = array_key_exists('label', $b) ? assert_no_html((string) $b['label'], 'Etiqueta') : (string) $existing['label'];
        $recipient = array_key_exists('recipientName', $b) ? assert_no_html((string) $b['recipientName'], 'Destinatario') : (string) $existing['recipient_name'];
        $phone = array_key_exists('phone', $b) ? trim((string) $b['phone']) : (string) $existing['phone'];
        $dept = array_key_exists('department', $b) ? assert_no_html((string) $b['department'], 'Departamento') : (string) $existing['department'];
        $city = array_key_exists('city', $b) ? assert_no_html((string) $b['city'], 'Ciudad') : (string) $existing['city'];
        $street = array_key_exists('streetAddress', $b) ? assert_no_html((string) $b['streetAddress'], 'Dirección') : (string) $existing['street_address'];
        $info = array_key_exists('additionalInfo', $b) ? assert_no_html((string) ($b['additionalInfo'] ?? ''), 'Detalle') : $existing['additional_info'];
        $isDefault = array_key_exists('isDefault', $b) ? (bool) $b['isDefault'] : (bool) $existing['is_default'];

        if ($isDefault) {
            $pdo->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?')->execute([$user['id']]);
        }

        $pdo->prepare(
            'UPDATE addresses SET label = ?, recipient_name = ?, phone = ?, department = ?, city = ?, street_address = ?, additional_info = ?, is_default = ?
             WHERE id = ? AND user_id = ?'
        )->execute([$label, $recipient, $phone, $dept, $city, $street, $info ?: null, $isDefault ? 1 : 0, $addressId, $user['id']]);

        $stmt->execute([$addressId, $user['id']]);
        api_success(['address' => self::formatAddress($stmt->fetch())]);
    }

    public static function addressDelete(string $addressId): never
    {
        $user = require_auth();
        $del = db()->prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?');
        $del->execute([$addressId, $user['id']]);
        if ($del->rowCount() === 0) {
            throw new ApiException('NOT_FOUND', 'Dirección no encontrada.', 404);
        }
        api_success(['deletedId' => $addressId]);
    }

    public static function privacyGet(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("privacy:get:{$ip}", 15, 60);
        $user = require_auth();
        $pdo = db();

        $uStmt = $pdo->prepare(
            'SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.document_type, u.document_number, u.created_at, u.updated_at,
                    r.code AS role_code, r.name AS role_name
             FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1'
        );
        $uStmt->execute([$user['id']]);
        $u = $uStmt->fetch();

        $addrStmt = $pdo->prepare('SELECT * FROM addresses WHERE user_id = ?');
        $addrStmt->execute([$user['id']]);
        $addresses = array_map([self::class, 'formatAddress'], $addrStmt->fetchAll());

        $ordStmt = $pdo->prepare(
            'SELECT order_number, total_cop, status, payment_method, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC'
        );
        $ordStmt->execute([$user['id']]);
        $orders = array_map(static fn (array $o): array => [
            'orderNumber' => $o['order_number'],
            'totalCop' => (int) $o['total_cop'],
            'status' => $o['status'],
            'paymentMethod' => $o['payment_method'],
            'createdAt' => iso_date($o['created_at']),
        ], $ordStmt->fetchAll());

        write_audit_log($user['id'], 'HABEAS_DATA_EXPORT_REQUESTED', 'User', $user['id'], ['regulation' => 'Ley 1581 de 2012']);

        api_success([
            'regulation' => 'Ley Estatutaria 1581 de 2012 y Decreto 1377 de 2013 (Habeas Data Colombia)',
            'exportedAt' => gmdate('c'),
            'subject' => [
                'id' => $u['id'],
                'name' => $u['name'],
                'email' => $u['email'],
                'phone' => $u['phone'],
                'avatarUrl' => $u['avatar_url'],
                'documentType' => $u['document_type'],
                'documentNumber' => $u['document_number'],
                'createdAt' => iso_date($u['created_at']),
                'updatedAt' => iso_date($u['updated_at']),
                'role' => ['code' => $u['role_code'], 'name' => role_label_es((string) $u['role_code'])],
                'addresses' => $addresses,
                'orders' => $orders,
            ],
        ]);
    }

    public static function privacyDelete(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("privacy:delete:{$ip}", 5, 900);
        $user = require_auth();

        if ($user['role'] === 'ADMIN') {
            throw new ApiException(
                'ADMIN_SUPPRESSION_BLOCKED',
                'Las cuentas administrativas activas no pueden anonimizarse desde el autoservicio.',
                409
            );
        }

        $pdo = db();
        $activeStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM orders WHERE user_id = ? AND status IN ('PENDING_PAYMENT','PENDING_BREB_VERIFICATION','PAID','PROCESSING','SHIPPED')"
        );
        $activeStmt->execute([$user['id']]);
        if ((int) $activeStmt->fetchColumn() > 0) {
            throw new ApiException(
                'ACTIVE_ORDERS_PENDING',
                'No es posible suprimir los datos mientras existan pedidos en curso.',
                409
            );
        }

        $prevAvatar = $pdo->prepare('SELECT avatar_url FROM users WHERE id = ? LIMIT 1');
        $prevAvatar->execute([$user['id']]);
        $avatarToDelete = $prevAvatar->fetchColumn();

        $anonEmail = 'anonimizado.' . $user['id'] . '@privacy.bspstore.com.co';

        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM addresses WHERE user_id = ?')->execute([$user['id']]);
            $pdo->prepare('DELETE FROM oauth_accounts WHERE user_id = ?')->execute([$user['id']]);
            $pdo->prepare('DELETE FROM password_reset_tokens WHERE user_id = ?')->execute([$user['id']]);
            $pdo->prepare('DELETE FROM favorites WHERE user_id = ?')->execute([$user['id']]);
            $pdo->prepare('DELETE FROM carts WHERE user_id = ?')->execute([$user['id']]);
            $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$user['id']]);
            $pdo->prepare(
                "UPDATE users SET name = 'Titular Anonimizado (Ley 1581)', email = ?, phone = NULL,
                 avatar_url = NULL, document_type = NULL, document_number = NULL, password_hash = NULL, is_active = 0
                 WHERE id = ?"
            )->execute([$anonEmail, $user['id']]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        if (is_string($avatarToDelete)) {
            delete_managed_media_by_url($avatarToDelete);
        }
        write_audit_log(null, 'HABEAS_DATA_ACCOUNT_ANONYMIZED', 'User', $user['id'], ['regulation' => 'Ley 1581 Art. 8']);
        clear_session_cookie();

        api_success([
            'anonymized' => true,
            'message' => 'Tus datos personales han sido anonimizados y tus sesiones revocadas conforme a la Ley 1581 de 2012.',
        ]);
    }
}
