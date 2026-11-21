<?php
declare(strict_types=1);

class OrderController
{
    public static function hydrateOrder(array $o): array
    {
        $pdo = db();
        $itStmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = ?');
        $itStmt->execute([$o['id']]);
        $items = array_map(static fn (array $i): array => [
            'id' => $i['id'],
            'productId' => $i['product_id'],
            'productName' => $i['product_name'],
            'sku' => $i['sku'],
            'unitPrice' => (int) $i['unit_price'],
            'quantity' => (int) $i['quantity'],
            'lineTotal' => (int) $i['line_total'],
        ], $itStmt->fetchAll());

        $payStmt = $pdo->prepare('SELECT * FROM payments WHERE order_id = ?');
        $payStmt->execute([$o['id']]);
        $payments = array_map(static fn (array $p): array => [
            'id' => $p['id'],
            'provider' => $p['provider'],
            'method' => $p['method'],
            'status' => $p['status'],
            'reference' => $p['reference'],
            'brebKeyUsed' => $p['breb_key_used'],
            'transferReceiptRef' => $p['transfer_receipt_ref'],
            'amountCop' => (int) $p['amount_cop'],
        ], $payStmt->fetchAll());

        $shStmt = $pdo->prepare(
            'SELECT s.*, c.id AS c_id, c.name AS c_name, c.code AS c_code
             FROM shipments s LEFT JOIN carriers c ON c.id = s.carrier_id WHERE s.order_id = ? LIMIT 1'
        );
        $shStmt->execute([$o['id']]);
        $sh = $shStmt->fetch();

        return [
            'id' => $o['id'],
            'orderNumber' => $o['order_number'],
            'userId' => $o['user_id'],
            'status' => $o['status'],
            'paymentMethod' => $o['payment_method'],
            'subtotalCop' => (int) $o['subtotal_cop'],
            'discountCop' => (int) $o['discount_cop'],
            'shippingCop' => (int) $o['shipping_cop'],
            'totalCop' => (int) $o['total_cop'],
            'customerName' => $o['customer_name'],
            'customerEmail' => $o['customer_email'],
            'customerPhone' => $o['customer_phone'],
            'department' => $o['department'],
            'city' => $o['city'],
            'streetAddress' => $o['street_address'],
            'additionalInfo' => $o['additional_info'],
            'createdAt' => iso_date($o['created_at']),
            'items' => $items,
            'payments' => $payments,
            'shipment' => $sh ? [
                'id' => $sh['id'],
                'status' => $sh['status'],
                'trackingNumber' => $sh['tracking_number'],
                'carrierId' => $sh['carrier_id'],
                'carrier' => $sh['c_id'] ? ['id' => $sh['c_id'], 'name' => $sh['c_name'], 'code' => $sh['c_code']] : null,
            ] : null,
        ];
    }

    public static function ordersGet(): never
    {
        $user = require_auth();
        $stmt = db()->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
        $stmt->execute([$user['id']]);
        $orders = array_map([self::class, 'hydrateOrder'], $stmt->fetchAll());
        api_success(['orders' => $orders]);
    }

    public static function ordersPost(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("order:create:{$ip}", 10, 60);
        $user = get_session_user();
        $b = read_json_body();

        $customerName = assert_no_html((string) ($b['customerName'] ?? ''), 'Nombre');
        $customerEmail = strtolower(trim((string) ($b['customerEmail'] ?? '')));
        $customerPhone = preg_replace('/\D/', '', (string) ($b['customerPhone'] ?? '')) ?? '';
        $department = assert_no_html((string) ($b['department'] ?? ''), 'Departamento');
        $city = assert_no_html((string) ($b['city'] ?? ''), 'Ciudad');
        $streetAddress = assert_no_html((string) ($b['streetAddress'] ?? ''), 'Dirección');
        $additionalInfo = isset($b['additionalInfo']) ? assert_no_html((string) $b['additionalInfo'], 'Detalle') : null;
        $paymentMethod = (string) ($b['paymentMethod'] ?? 'BREB');
        $couponCode = isset($b['couponCode']) ? trim((string) $b['couponCode']) : '';
        $rawItems = $b['items'] ?? [];

        if (
            mb_strlen($customerName) < 2 || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL) ||
            strlen($customerPhone) < 7 || strlen($customerPhone) > 15 ||
            mb_strlen($department) < 2 || mb_strlen($city) < 2 || mb_strlen($streetAddress) < 5 ||
            !in_array($paymentMethod, ['BREB', 'WOMPI_PSE', 'WOMPI_CARD'], true) ||
            !is_array($rawItems) || count($rawItems) === 0 || count($rawItems) > 50
        ) {
            throw new ApiException('VALIDATION_ERROR', 'Verifica los datos del comprador, dirección y productos del pedido.', 422);
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            // Consolidar cantidades por producto (previene bypass de stock con líneas duplicadas)
            $consolidated = [];
            foreach ($rawItems as $req) {
                $ref = (string) ($req['productIdOrLegacyId'] ?? '');
                $qty = (int) ($req['quantity'] ?? 0);
                if ($ref === '' || $qty < 1 || $qty > 20) {
                    throw new ApiException('VALIDATION_ERROR', 'Cantidad de producto inválida.', 422);
                }

                $isNum = ctype_digit($ref) && (int) $ref > 0;
                $pStmt = $pdo->prepare(
                    'SELECT p.id, p.name, p.sku, p.price, i.id AS inv_id, i.quantity_on_hand, i.quantity_reserved
                     FROM products p INNER JOIN inventories i ON i.product_id = p.id
                     WHERE p.is_active = 1 AND (' . ($isNum ? 'p.legacy_id = ? OR ' : '') . 'p.id = ?)' . sql_for_update()
                );
                $pStmt->execute($isNum ? [(int) $ref, $ref] : [$ref]);
                $p = $pStmt->fetch();
                if (!$p) {
                    throw new ApiException('PRODUCT_UNAVAILABLE', "El producto ({$ref}) no está disponible.", 404);
                }

                $pid = (string) $p['id'];
                $avail = (int) $p['quantity_on_hand'] - (int) $p['quantity_reserved'];
                $nextQty = ($consolidated[$pid]['quantity'] ?? 0) + $qty;
                if ($avail < $nextQty) {
                    throw new ApiException('INSUFFICIENT_STOCK', "Inventario insuficiente para {$p['name']}. Disponibles: " . max(0, $avail) . '.', 409);
                }

                $consolidated[$pid] = [
                    'product_id' => $pid,
                    'inv_id' => (string) $p['inv_id'],
                    'product_name' => (string) $p['name'],
                    'sku' => (string) $p['sku'],
                    'unit_price' => (int) $p['price'],
                    'quantity' => $nextQty,
                    'line_total' => (int) $p['price'] * $nextQty,
                ];
            }

            $subtotalCop = array_sum(array_column($consolidated, 'line_total'));
            $discountCop = 0;
            $couponId = null;

            if ($couponCode !== '') {
                $couponRes = CatalogController::validateCouponForSubtotal($couponCode, $subtotalCop);
                $discountCop = $couponRes['discountCop'];
                $couponId = $couponRes['couponId'];
                $pdo->prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?')->execute([$couponId]);
            }

            $shippingQuote = calculate_shipping_quote($department, $city, $subtotalCop - $discountCop);
            $shippingCop = $shippingQuote['shippingCop'];
            $totalCop = max(0, $subtotalCop - $discountCop + $shippingCop);

            $orderId = generate_id('ord');
            $orderNumber = 'BSP-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
            $isBreb = $paymentMethod === 'BREB';
            $status = $isBreb ? 'PENDING_BREB_VERIFICATION' : 'PENDING_PAYMENT';

            $pdo->prepare(
                'INSERT INTO orders (id, order_number, user_id, coupon_id, status, payment_method, subtotal_cop, discount_cop, shipping_cop, total_cop,
                                     customer_name, customer_email, customer_phone, department, city, street_address, additional_info)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $orderId, $orderNumber, $user['id'] ?? null, $couponId, $status, $paymentMethod,
                $subtotalCop, $discountCop, $shippingCop, $totalCop,
                $customerName, $customerEmail, $customerPhone, $department, $city, $streetAddress, $additionalInfo ?: null,
            ]);

            foreach ($consolidated as $item) {
                $pdo->prepare(
                    'INSERT INTO order_items (id, order_id, product_id, product_name, sku, unit_price, quantity, line_total)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    generate_id('oit'), $orderId, $item['product_id'], $item['product_name'],
                    $item['sku'], $item['unit_price'], $item['quantity'], $item['line_total'],
                ]);
                $pdo->prepare('UPDATE inventories SET quantity_reserved = quantity_reserved + ? WHERE id = ?')
                    ->execute([$item['quantity'], $item['inv_id']]);
                $pdo->prepare(
                    "INSERT INTO inventory_movements (id, inventory_id, type, quantity, reason, reference_id, created_by_id)
                     VALUES (?, ?, 'RESERVATION', ?, 'Reserva de inventario por pedido en Checkout', ?, ?)"
                )->execute([generate_id('mov'), $item['inv_id'], $item['quantity'], $orderNumber, $user['id'] ?? null]);
            }

            $carrierCode = $shippingQuote['isLocalDelivery'] ? 'DOMICILIO_LOCAL' : 'SERVIENTREGA';
            $carrierId = $pdo->prepare('SELECT id FROM carriers WHERE code = ? LIMIT 1');
            $carrierId->execute([$carrierCode]);
            $cid = $carrierId->fetchColumn() ?: null;

            $pdo->prepare("INSERT INTO shipments (id, order_id, carrier_id, status) VALUES (?, ?, ?, 'PENDING')")
                ->execute([generate_id('shp'), $orderId, $cid]);

            $brebKey = (string) (app_config()['breb']['key'] ?? '@bbbsp');
            $payId = generate_id('pay');
            $pdo->prepare(
                "INSERT INTO payments (id, order_id, provider, method, reference, breb_key_used, amount_cop, currency, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'COP', 'PENDING')"
            )->execute([
                $payId, $orderId, $isBreb ? 'BREB_TRANSFER' : 'WOMPI', $paymentMethod,
                $orderNumber, $isBreb ? $brebKey : null, $totalCop,
            ]);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        write_audit_log($user['id'] ?? null, 'ORDER_CREATED', 'Order', $orderId, [
            'orderNumber' => $orderNumber,
            'totalCop' => $totalCop,
            'paymentMethod' => $paymentMethod,
        ]);

        $ordStmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? LIMIT 1');
        $ordStmt->execute([$orderId]);
        $orderRow = $ordStmt->fetch();
        $hydrated = self::hydrateOrder($orderRow);

        send_order_confirmation_email($orderRow, array_values($consolidated));

        $brebInstructions = $isBreb ? [
            'brebKey' => $brebKey,
            'recipientName' => (string) (app_config()['breb']['recipient_name'] ?? 'BSP Store Colombia'),
            'amountCop' => $totalCop,
            'reference' => $orderNumber,
            'commissionCop' => 0,
            'instructions' => [
                "Abre tu app bancaria o billetera con Bre-B y selecciona transferir con Llave.",
                "Ingresa la Llave Bre-B oficial {$brebKey} a nombre de BSP Store Colombia.",
                "Transfiere exactamente " . email_format_cop($totalCop) . " indicando el pedido {$orderNumber} y registra el número de comprobante.",
            ],
        ] : null;

        $wompiSession = null;
        if (!$isBreb) {
            $w = app_config()['wompi'] ?? [];
            $amountCents = $totalCop * 100;
            $integritySecret = (string) ($w['integrity_secret'] ?? 'test_integrity_secret_bsp_store');
            $sig = hash('sha256', "{$orderNumber}{$amountCents}COP{$integritySecret}");
            $pubKey = (string) ($w['public_key'] ?? 'pub_test_bsp_store');
            $redirect = rtrim((string) (app_config()['app_url'] ?? 'https://bspstore.com.co'), '/') . '/seguimiento/';
            $wompiSession = [
                'provider' => 'WOMPI',
                'reference' => $orderNumber,
                'amountInCents' => $amountCents,
                'currency' => 'COP',
                'publicKey' => $pubKey,
                'integritySignature' => $sig,
                'checkoutUrl' => 'https://checkout.wompi.co/p/?' . http_build_query([
                    'public-key' => $pubKey,
                    'currency' => 'COP',
                    'amount-in-cents' => $amountCents,
                    'reference' => $orderNumber,
                    'signature:integrity' => $sig,
                    'redirect-url' => $redirect,
                ]),
            ];
        }

        api_success([
            'order' => $hydrated,
            'payment' => $hydrated['payments'][0] ?? null,
            'brebInstructions' => $brebInstructions,
            'wompiSession' => $wompiSession,
        ], 201);
    }

    public static function orderByNumberGet(string $orderNumber): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("order:get:{$ip}", 20, 900);

        $clean = strtoupper(trim($orderNumber));
        $stmt = db()->prepare('SELECT * FROM orders WHERE order_number = ? LIMIT 1');
        $stmt->execute([$clean]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new ApiException('ORDER_NOT_FOUND', 'El pedido consultado no existe.', 404);
        }

        $full = self::hydrateOrder($row);
        $user = get_session_user();
        $emailParam = strtolower(trim((string) ($_GET['email'] ?? '')));

        $isAdmin = $user && in_array($user['role'], ['ADMIN', 'STAFF'], true);
        $isOwner = $user && $row['user_id'] && $row['user_id'] === $user['id'];
        $isEmailMatch = $emailParam !== '' && $emailParam === strtolower((string) $row['customer_email']);

        if ($isAdmin || $isOwner || $isEmailMatch) {
            api_success(['order' => $full, 'isPublicTrackingView' => false]);
        }

        // Vista pública (/seguimiento): cero exposición de PII
        api_success([
            'order' => [
                'id' => $full['id'],
                'orderNumber' => $full['orderNumber'],
                'status' => $full['status'],
                'department' => $full['department'],
                'city' => $full['city'],
                'totalCop' => $full['totalCop'],
                'shippingCop' => $full['shippingCop'],
                'createdAt' => $full['createdAt'],
                'items' => $full['items'],
                'payments' => [],
                'shipment' => $full['shipment'],
            ],
            'isPublicTrackingView' => true,
        ]);
    }

    public static function orderBrebReceiptPost(string $orderNumber): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("order:breb:{$ip}", 10, 60);

        $user = get_session_user();
        $b = read_json_body();
        $ref = trim((string) ($b['transferReceiptRef'] ?? ''));
        $email = strtolower(trim((string) ($b['customerEmail'] ?? ($user['email'] ?? ''))));

        if (strlen($ref) < 4 || strlen($ref) > 80) {
            throw new ApiException('INVALID_RECEIPT_REF', 'Ingresa un número de comprobante válido (mínimo 4 caracteres).', 400);
        }
        if (!$user && $email === '') {
            throw new ApiException('FORBIDDEN_ORDER_ACCESS', 'Inicia sesión o ingresa el correo del pedido.', 403);
        }

        $pdo = db();
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_number = ? LIMIT 1');
        $stmt->execute([strtoupper(trim($orderNumber))]);
        $order = $stmt->fetch();
        if (!$order) {
            throw new ApiException('ORDER_NOT_FOUND', 'Pedido no encontrado.', 404);
        }

        $isAdmin = $user && in_array($user['role'], ['ADMIN', 'STAFF'], true);
        if (!$isAdmin) {
            if ($order['user_id'] !== null) {
                if (!$user || $user['id'] !== $order['user_id']) {
                    throw new ApiException('FORBIDDEN_ORDER_ACCESS', 'No tienes autorización para modificar este pedido.', 403);
                }
            } elseif ($email !== strtolower((string) $order['customer_email'])) {
                throw new ApiException('FORBIDDEN_ORDER_ACCESS', 'El correo no coincide con el titular del pedido.', 403);
            }
        }

        if (!in_array($order['status'], ['PENDING_BREB_VERIFICATION', 'PENDING_PAYMENT'], true)) {
            throw new ApiException('ORDER_NOT_EDITABLE', 'Este pedido ya fue procesado.', 409);
        }

        $upd = $pdo->prepare("UPDATE payments SET transfer_receipt_ref = ? WHERE order_id = ? AND provider = 'BREB_TRANSFER'");
        $upd->execute([$ref, $order['id']]);
        if ($upd->rowCount() === 0) {
            throw new ApiException('NOT_BREB_ORDER', 'Este pedido no corresponde a una transferencia Bre-B.', 400);
        }

        write_audit_log($user['id'] ?? $order['user_id'], 'BREB_RECEIPT_SUBMITTED', 'Order', $order['id'], [
            'orderNumber' => $order['order_number'],
            'transferReceiptRef' => $ref,
        ]);

        api_success([
            'orderNumber' => $order['order_number'],
            'status' => $order['status'],
            'transferReceiptRef' => $ref,
        ]);
    }

    public static function orderCancelPatch(string $orderNumber): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("order:cancel:{$ip}", 10, 60);

        $user = get_session_user();
        $b = read_json_body();
        $email = strtolower(trim((string) ($b['customerEmail'] ?? ($user['email'] ?? ''))));
        $reason = substr(trim((string) ($b['reason'] ?? 'Cancelado por el cliente')), 0, 300);

        $pdo = db();
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_number = ? LIMIT 1');
        $stmt->execute([strtoupper(trim($orderNumber))]);
        $order = $stmt->fetch();
        if (!$order) {
            throw new ApiException('ORDER_NOT_FOUND', 'Pedido no encontrado.', 404);
        }

        $isAdmin = $user && in_array($user['role'], ['ADMIN', 'STAFF'], true);
        $isOwner = $user && $order['user_id'] && $user['id'] === $order['user_id'];
        $isGuestEmail = $order['user_id'] === null && $email !== '' && $email === strtolower((string) $order['customer_email']);

        if (!$isAdmin && !$isOwner && !$isGuestEmail) {
            throw new ApiException('FORBIDDEN_ORDER_ACCESS', 'No tienes autorización para cancelar este pedido.', 403);
        }

        if (!in_array($order['status'], ['PENDING_PAYMENT', 'PENDING_BREB_VERIFICATION'], true)) {
            throw new ApiException('ORDER_CANNOT_BE_CANCELLED', 'Solo se pueden cancelar pedidos pendientes de pago o verificación.', 409);
        }

        $pdo->beginTransaction();
        try {
            $itemsStmt = $pdo->prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?');
            $itemsStmt->execute([$order['id']]);
            foreach ($itemsStmt->fetchAll() as $it) {
                $invStmt = $pdo->prepare('SELECT id, quantity_reserved FROM inventories WHERE product_id = ?' . sql_for_update());
                $invStmt->execute([$it['product_id']]);
                $inv = $invStmt->fetch();
                if ($inv) {
                    $nextRes = max(0, (int) $inv['quantity_reserved'] - (int) $it['quantity']);
                    $pdo->prepare('UPDATE inventories SET quantity_reserved = ? WHERE id = ?')->execute([$nextRes, $inv['id']]);
                    $pdo->prepare(
                        "INSERT INTO inventory_movements (id, inventory_id, type, quantity, reason, reference_id, created_by_id)
                         VALUES (?, ?, 'RELEASE', ?, ?, ?, ?)"
                    )->execute([generate_id('mov'), $inv['id'], $it['quantity'], $reason, $order['order_number'], $user['id'] ?? $order['user_id']]);
                }
            }

            $pdo->prepare("UPDATE orders SET status = 'CANCELLED', notes = ? WHERE id = ?")->execute([$reason, $order['id']]);
            $pdo->prepare("UPDATE payments SET status = 'VOIDED' WHERE order_id = ?")->execute([$order['id']]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $stmt->execute([strtoupper(trim($orderNumber))]);
        api_success(['order' => self::hydrateOrder($stmt->fetch())]);
    }

    public static function wompiWebhook(): never
    {
        $raw = file_get_contents('php://input') ?: '';
        if (strlen($raw) > 65536) {
            throw new ApiException('PAYLOAD_TOO_LARGE', 'Webhook excede el tamaño máximo.', 413);
        }
        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            throw new ApiException('INVALID_JSON', 'Payload de webhook inválido.', 400);
        }

        $eventsSecret = (string) (app_config()['wompi']['events_secret'] ?? 'test_events_secret_bsp_store');
        $props = $payload['signature']['properties'] ?? [];
        $checksum = strtolower(trim((string) ($payload['signature']['checksum'] ?? ($_SERVER['HTTP_X_EVENT_CHECKSUM'] ?? ''))));
        $timestamp = (string) ($payload['timestamp'] ?? '');

        $concat = '';
        foreach ($props as $prop) {
            $cursor = $payload['data'] ?? [];
            foreach (explode('.', (string) $prop) as $seg) {
                $cursor = is_array($cursor) && array_key_exists($seg, $cursor) ? $cursor[$seg] : '';
            }
            $concat .= (string) $cursor;
        }
        $expected = hash('sha256', $concat . $timestamp . $eventsSecret);

        if ($checksum === '' || !hash_equals($expected, $checksum)) {
            throw new ApiException('INVALID_WEBHOOK_SIGNATURE', 'La firma criptográfica del webhook de Wompi no es válida.', 401);
        }

        $tx = $payload['data']['transaction'] ?? [];
        $eventId = trim((string) ($payload['id'] ?? ''));
        $reference = strtoupper(trim((string) ($tx['reference'] ?? '')));
        $txStatus = strtoupper(trim((string) ($tx['status'] ?? '')));
        $txId = trim((string) ($tx['id'] ?? ''));

        if ($eventId === '' || $reference === '') {
            throw new ApiException('INVALID_WEBHOOK_DATA', 'Faltan identificadores del evento Wompi.', 400);
        }

        $pdo = db();
        $dup = $pdo->prepare('SELECT id FROM payment_events WHERE event_id = ? LIMIT 1');
        $dup->execute([$eventId]);
        if ($dup->fetch()) {
            api_success(['eventId' => $eventId, 'status' => $txStatus, 'idempotentDuplicate' => true]);
        }

        $oStmt = $pdo->prepare('SELECT * FROM orders WHERE order_number = ? LIMIT 1');
        $oStmt->execute([$reference]);
        $order = $oStmt->fetch();
        if (!$order) {
            throw new ApiException('ORDER_NOT_FOUND', 'Pedido referenciado por Wompi no encontrado.', 404);
        }

        $pStmt = $pdo->prepare('SELECT * FROM payments WHERE order_id = ? LIMIT 1');
        $pStmt->execute([$order['id']]);
        $payment = $pStmt->fetch();

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO payment_events (id, payment_id, provider, event_id, event_type, signature_valid, payload)
                 VALUES (?, ?, ?, ?, ?, 1, ?)'
            )->execute([generate_id('pev'), $payment['id'] ?? null, 'WOMPI', $eventId, (string) ($payload['event'] ?? 'transaction.updated'), $raw]);

            if ($txStatus === 'APPROVED' && $order['status'] !== 'PAID') {
                $pdo->prepare("UPDATE orders SET status = 'PAID' WHERE id = ?")->execute([$order['id']]);
                if ($payment) {
                    $pdo->prepare("UPDATE payments SET status = 'APPROVED', external_transaction_id = ?, verified_at = ? WHERE id = ?")
                        ->execute([$txId ?: null, now_utc(), $payment['id']]);
                }
                $its = $pdo->prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?');
                $its->execute([$order['id']]);
                foreach ($its->fetchAll() as $it) {
                    $inv = $pdo->prepare('SELECT id, quantity_on_hand, quantity_reserved FROM inventories WHERE product_id = ?' . sql_for_update());
                    $inv->execute([$it['product_id']]);
                    $invRow = $inv->fetch();
                    if ($invRow) {
                        $newHand = max(0, (int) $invRow['quantity_on_hand'] - (int) $it['quantity']);
                        $newRes = max(0, (int) $invRow['quantity_reserved'] - (int) $it['quantity']);
                        $pdo->prepare('UPDATE inventories SET quantity_on_hand = ?, quantity_reserved = ? WHERE id = ?')
                            ->execute([$newHand, $newRes, $invRow['id']]);
                    }
                }
            } elseif (in_array($txStatus, ['DECLINED', 'VOIDED', 'ERROR'], true)) {
                $pdo->prepare("UPDATE orders SET status = 'CANCELLED' WHERE id = ? AND status = 'PENDING_PAYMENT'")->execute([$order['id']]);
                if ($payment) {
                    $pdo->prepare('UPDATE payments SET status = ? WHERE id = ?')->execute([$txStatus, $payment['id']]);
                }
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        api_success(['eventId' => $eventId, 'status' => $txStatus, 'idempotentDuplicate' => false]);
    }

    public static function contactGet(): never
    {
        require_admin(false);
        $raw = db_get_setting('contact.inquiries');
        $list = is_string($raw) ? (json_decode($raw, true) ?: []) : [];
        api_success(['total' => count($list), 'inquiries' => $list]);
    }

    public static function contactPost(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("contact:post:{$ip}", 8, 600);
        $user = get_session_user();
        $b = read_json_body();

        $name = assert_no_html((string) ($b['name'] ?? ''), 'Nombre');
        $email = strtolower(trim((string) ($b['email'] ?? '')));
        $topic = assert_no_html((string) ($b['topic'] ?? 'Asesoría de productos'), 'Asunto');
        $message = assert_no_html((string) ($b['message'] ?? ''), 'Mensaje');

        if (mb_strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($message) < 10) {
            throw new ApiException('VALIDATION_ERROR', 'Completa tu nombre, correo válido y un mensaje de al menos 10 caracteres.', 422);
        }

        $raw = db_get_setting('contact.inquiries');
        $list = is_string($raw) ? (json_decode($raw, true) ?: []) : [];
        if (!is_array($list)) {
            $list = [];
        }

        $inquiry = [
            'id' => generate_id('inq'),
            'name' => substr($name, 0, 120),
            'email' => $email,
            'topic' => substr($topic, 0, 120),
            'message' => substr($message, 0, 2000),
            'userId' => $user['id'] ?? null,
            'createdAt' => gmdate('c'),
        ];

        array_unshift($list, $inquiry);
        $list = array_slice($list, 0, 200);

        db_upsert_setting(
            'contact.inquiries',
            json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]',
            'Consultas desde /contacto'
        );

        write_audit_log($user['id'] ?? null, 'CONTACT_INQUIRY_CREATED', 'ContactInquiry', $inquiry['id'], [
            'email' => $email,
            'topic' => $topic,
        ]);
        send_contact_inquiry_notification_email($inquiry['name'], $inquiry['email'], $inquiry['topic'], $inquiry['message']);

        api_success(['inquiry' => $inquiry], 201);
    }
}
