<?php
declare(strict_types=1);

class CatalogController
{
    private static function hydrateProducts(array $rows): array
    {
        if (!$rows) {
            return [];
        }
        $pdo = db();
        $ids = array_column($rows, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        $imgStmt = $pdo->prepare(
            "SELECT * FROM product_images WHERE product_id IN ({$placeholders}) ORDER BY is_primary DESC, sort_order ASC"
        );
        $imgStmt->execute($ids);
        $imagesByProd = [];
        foreach ($imgStmt->fetchAll() as $img) {
            $imagesByProd[$img['product_id']][] = $img;
        }

        $varStmt = $pdo->prepare(
            "SELECT * FROM product_variants WHERE product_id IN ({$placeholders}) AND is_active = 1"
        );
        $varStmt->execute($ids);
        $varsByProd = [];
        foreach ($varStmt->fetchAll() as $v) {
            $varsByProd[$v['product_id']][] = $v;
        }

        $result = [];
        foreach ($rows as $idx => $p) {
            $pid = (string) $p['id'];
            $imgs = $imagesByProd[$pid] ?? [];
            $vars = $varsByProd[$pid] ?? [];
            $primaryImg = $imgs[0]['url'] ?? '/images/g502x-plus-gallery-1-black.png';
            $price = (int) $p['price'];
            $compare = $p['compare_at_price'] !== null ? (int) $p['compare_at_price'] : null;
            $onHand = (int) ($p['quantity_on_hand'] ?? 0);
            $reserved = (int) ($p['quantity_reserved'] ?? 0);
            $avail = max(0, $onHand - $reserved);
            $specs = json_decode((string) ($p['specs'] ?? '[]'), true);
            $discountPct = ($compare !== null && $compare > $price)
                ? (int) round((($compare - $price) / $compare) * 100)
                : 0;

            $result[] = [
                'id' => $p['legacy_id'] !== null ? (int) $p['legacy_id'] : (100 + $idx),
                'dbId' => $pid,
                'slug' => (string) $p['slug'],
                'sku' => (string) $p['sku'],
                'name' => (string) $p['name'],
                'brand' => (string) $p['brand_name'],
                'brandId' => (string) $p['brand_id'],
                'category' => (string) $p['category_name'],
                'categoryId' => (string) $p['category_id'],
                'price' => $price,
                'compareAtPrice' => $compare,
                'discountPercent' => $discountPct,
                'tag' => $p['tag'] !== null ? (string) $p['tag'] : null,
                'image' => (string) $primaryImg,
                'gallery' => array_map(static fn (array $im): string => (string) $im['url'], $imgs),
                'description' => (string) $p['description'],
                'specs' => is_array($specs) ? $specs : [],
                'variants' => array_map(static fn (array $v): array => [
                    'id' => (string) $v['id'],
                    'sku' => (string) $v['sku'],
                    'label' => (string) ($v['option_value'] ?: $v['name']),
                    'colorHex' => $v['color_hex'] !== null ? (string) $v['color_hex'] : null,
                    'priceOverride' => $v['price_override'] !== null ? (int) $v['price_override'] : null,
                ], $vars),
                'stockAvailable' => $avail,
                'isFeatured' => (bool) $p['is_featured'],
                'isNew' => (bool) $p['is_new'],
                'isOffer' => (bool) $p['is_offer'] || ($compare !== null && $compare > $price),
            ];
        }

        return $result;
    }

    public static function listProducts(): never
    {
        $pdo = db();
        $where = ['p.is_active = 1'];
        $params = [];

        $category = trim((string) ($_GET['category'] ?? ''));
        if ($category !== '' && $category !== 'Todas') {
            $where[] = '(LOWER(c.name) = LOWER(?) OR LOWER(c.slug) = LOWER(?))';
            $params[] = $category;
            $params[] = $category;
        }
        $categoryId = trim((string) ($_GET['categoryId'] ?? ''));
        if ($categoryId !== '' && $categoryId !== 'ALL') {
            $where[] = 'p.category_id = ?';
            $params[] = $categoryId;
        }
        $brand = trim((string) ($_GET['brand'] ?? ''));
        if ($brand !== '' && $brand !== 'Todas') {
            $where[] = '(LOWER(b.name) = LOWER(?) OR LOWER(b.slug) = LOWER(?))';
            $params[] = $brand;
            $params[] = $brand;
        }
        $brandId = trim((string) ($_GET['brandId'] ?? ''));
        if ($brandId !== '' && $brandId !== 'ALL') {
            $where[] = 'p.brand_id = ?';
            $params[] = $brandId;
        }
        $productId = trim((string) ($_GET['productId'] ?? ''));
        if ($productId !== '' && $productId !== 'ALL') {
            $where[] = 'p.id = ?';
            $params[] = $productId;
        }
        $q = substr(trim((string) ($_GET['q'] ?? '')), 0, 100);
        if ($q !== '') {
            $like = '%' . $q . '%';
            $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ? OR b.name LIKE ? OR c.name LIKE ?)';
            array_push($params, $like, $like, $like, $like, $like);
        }
        if (isset($_GET['maxPrice']) && is_numeric($_GET['maxPrice']) && (int) $_GET['maxPrice'] > 0) {
            $where[] = 'p.price <= ?';
            $params[] = (int) $_GET['maxPrice'];
        }
        if (($_GET['inStock'] ?? '') === 'true') {
            $where[] = '(COALESCE(i.quantity_on_hand, 0) - COALESCE(i.quantity_reserved, 0)) > 0';
        }
        if (($_GET['onlyOffers'] ?? '') === 'true') {
            $where[] = '(p.is_offer = 1 OR (p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price))';
        }

        $sort = (string) ($_GET['sort'] ?? 'relevance');
        $orderBy = match ($sort) {
            'asc' => 'p.price ASC',
            'desc' => 'p.price DESC',
            'new' => 'p.is_new DESC, p.created_at DESC',
            default => 'p.is_featured DESC, p.legacy_id ASC, p.created_at DESC',
        };

        $page = max(1, (int) ($_GET['page'] ?? 1));
        $pageSize = min(100, max(1, (int) ($_GET['pageSize'] ?? 12)));
        $offset = ($page - 1) * $pageSize;

        $whereSql = implode(' AND ', $where);
        $countStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM products p
             INNER JOIN categories c ON c.id = p.category_id
             INNER JOIN brands b ON b.id = p.brand_id
             LEFT JOIN inventories i ON i.product_id = p.id
             WHERE {$whereSql}"
        );
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT p.*, c.name AS category_name, b.name AS brand_name,
                       i.quantity_on_hand, i.quantity_reserved
                FROM products p
                INNER JOIN categories c ON c.id = p.category_id
                INNER JOIN brands b ON b.id = p.brand_id
                LEFT JOIN inventories i ON i.product_id = p.id
                WHERE {$whereSql}
                ORDER BY {$orderBy}
                LIMIT {$pageSize} OFFSET {$offset}";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = self::hydrateProducts($stmt->fetchAll());

        api_success([
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => max(1, (int) ceil($total / $pageSize)),
            ],
        ]);
    }

    public static function getProductDetail(string $idOrSlug): never
    {
        $pdo = db();
        $isNum = ctype_digit($idOrSlug) && (int) $idOrSlug > 0;
        $stmt = $pdo->prepare(
            'SELECT p.*, c.name AS category_name, b.name AS brand_name,
                    i.quantity_on_hand, i.quantity_reserved
             FROM products p
             INNER JOIN categories c ON c.id = p.category_id
             INNER JOIN brands b ON b.id = p.brand_id
             LEFT JOIN inventories i ON i.product_id = p.id
             WHERE p.is_active = 1 AND (' . ($isNum ? 'p.legacy_id = ? OR ' : '') . 'p.slug = ? OR p.id = ?)
             LIMIT 1'
        );
        $stmt->execute($isNum ? [(int) $idOrSlug, $idOrSlug, $idOrSlug] : [$idOrSlug, $idOrSlug]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new ApiException('PRODUCT_NOT_FOUND', 'El producto solicitado no fue encontrado.', 404);
        }

        $product = self::hydrateProducts([$row])[0];

        $relStmt = $pdo->prepare(
            'SELECT p.*, c.name AS category_name, b.name AS brand_name,
                    i.quantity_on_hand, i.quantity_reserved
             FROM products p
             INNER JOIN categories c ON c.id = p.category_id
             INNER JOIN brands b ON b.id = p.brand_id
             LEFT JOIN inventories i ON i.product_id = p.id
             WHERE p.is_active = 1 AND p.id != ?
             ORDER BY CASE WHEN p.category_id = ? THEN 0 ELSE 1 END ASC, p.is_featured DESC
             LIMIT 4'
        );
        $relStmt->execute([$row['id'], $row['category_id']]);
        $related = self::hydrateProducts($relStmt->fetchAll());

        api_success(['product' => $product, 'related' => $related]);
    }

    public static function listCategoriesAndBrands(): never
    {
        $pdo = db();
        $cats = $pdo->query(
            'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
             FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order ASC, c.name ASC'
        )->fetchAll();

        $brands = $pdo->query(
            'SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.is_active = 1) AS product_count
             FROM brands b WHERE b.is_active = 1 ORDER BY b.name ASC'
        )->fetchAll();

        api_success([
            'categories' => array_map(static fn (array $c): array => [
                'id' => $c['id'],
                'name' => $c['name'],
                'slug' => $c['slug'],
                'description' => $c['description'],
                'icon' => $c['icon'],
                'imageUrl' => $c['image_url'],
                'productCount' => (int) $c['product_count'],
            ], $cats),
            'brands' => array_map(static fn (array $b): array => [
                'id' => $b['id'],
                'name' => $b['name'],
                'slug' => $b['slug'],
                'description' => $b['description'],
                'logoUrl' => $b['logo_url'],
                'productCount' => (int) $b['product_count'],
            ], $brands),
        ]);
    }

    public static function getReviews(string $idOrSlug): never
    {
        $pdo = db();
        $setting = db_get_setting('product.reviews');
        $all = is_string($setting) ? (json_decode($setting, true) ?: []) : [];
        if (!is_array($all)) {
            $all = [];
        }

        if ($idOrSlug === 'all') {
            $avg = count($all) > 0
                ? round(array_sum(array_column($all, 'rating')) / count($all), 1)
                : 0;
            api_success(['reviews' => array_slice($all, 0, 12), 'averageRating' => $avg, 'total' => count($all)]);
        }

        $isNum = ctype_digit($idOrSlug) && (int) $idOrSlug > 0;
        $pStmt = $pdo->prepare('SELECT slug FROM products WHERE ' . ($isNum ? 'legacy_id = ? OR ' : '') . 'slug = ? OR id = ? LIMIT 1');
        $pStmt->execute($isNum ? [(int) $idOrSlug, $idOrSlug, $idOrSlug] : [$idOrSlug, $idOrSlug]);
        $slug = (string) ($pStmt->fetchColumn() ?: $idOrSlug);

        $filtered = array_values(array_filter($all, static fn (array $r): bool => ($r['productSlug'] ?? '') === $slug));
        $avg = count($filtered) > 0
            ? round(array_sum(array_column($filtered, 'rating')) / count($filtered), 1)
            : 0;

        api_success(['reviews' => $filtered, 'averageRating' => $avg, 'total' => count($filtered)]);
    }

    public static function postReview(string $idOrSlug): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("reviews:post:{$ip}", 10, 600);
        $user = require_auth();
        $body = read_json_body();

        $rating = (int) ($body['rating'] ?? 5);
        $title = assert_no_html((string) ($body['title'] ?? ''), 'El título');
        $comment = assert_no_html((string) ($body['comment'] ?? ''), 'El comentario');

        if ($rating < 1 || $rating > 5 || mb_strlen($title) < 3 || mb_strlen($comment) < 8) {
            throw new ApiException('VALIDATION_ERROR', 'Completa calificación (1-5), título y comentario.', 422);
        }

        $pdo = db();
        $isNum = ctype_digit($idOrSlug) && (int) $idOrSlug > 0;
        $pStmt = $pdo->prepare('SELECT id, slug FROM products WHERE ' . ($isNum ? 'legacy_id = ? OR ' : '') . 'slug = ? OR id = ? LIMIT 1');
        $pStmt->execute($isNum ? [(int) $idOrSlug, $idOrSlug, $idOrSlug] : [$idOrSlug, $idOrSlug]);
        $prod = $pStmt->fetch();
        if (!$prod) {
            throw new ApiException('PRODUCT_NOT_FOUND', 'Producto no encontrado.', 404);
        }

        $boughtStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM orders o
             INNER JOIN order_items oi ON oi.order_id = o.id
             WHERE o.user_id = ? AND oi.product_id = ? AND o.status IN ('PAID','PROCESSING','SHIPPED','DELIVERED')"
        );
        $boughtStmt->execute([$user['id'], $prod['id']]);
        $verified = (int) $boughtStmt->fetchColumn() > 0;

        $setting = db_get_setting('product.reviews');
        $all = is_string($setting) ? (json_decode($setting, true) ?: []) : [];
        if (!is_array($all)) {
            $all = [];
        }

        $review = [
            'id' => generate_id('rev'),
            'productSlug' => (string) $prod['slug'],
            'userId' => $user['id'],
            'authorName' => $user['name'],
            'rating' => $rating,
            'title' => substr($title, 0, 120),
            'comment' => substr($comment, 0, 1200),
            'verifiedPurchase' => $verified,
            'createdAt' => gmdate('c'),
        ];

        array_unshift($all, $review);
        $all = array_slice($all, 0, 300);

        db_upsert_setting(
            'product.reviews',
            json_encode($all, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]',
            'Opiniones de clientes'
        );

        api_success(['review' => $review], 201);
    }

    public static function couponsGet(): never
    {
        $now = now_utc();
        $stmt = db()->prepare(
            'SELECT id, code, description, type, value, min_order_cop, expires_at
             FROM coupons WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > ?)
             ORDER BY created_at ASC'
        );
        $stmt->execute([$now]);
        $coupons = array_map(static fn (array $c): array => [
            'id' => $c['id'],
            'code' => $c['code'],
            'description' => $c['description'],
            'type' => $c['type'],
            'value' => (int) $c['value'],
            'minOrderCop' => (int) $c['min_order_cop'],
            'expiresAt' => iso_date($c['expires_at']),
        ], $stmt->fetchAll());

        api_success(['coupons' => $coupons]);
    }

    public static function couponsPost(): never
    {
        $admin = require_admin(true);
        $body = read_json_body();
        $code = strtoupper(trim((string) ($body['code'] ?? '')));
        $desc = assert_no_html((string) ($body['description'] ?? ''), 'La descripción');
        $type = (string) ($body['type'] ?? 'PERCENTAGE');
        $value = (int) ($body['value'] ?? 0);
        $minOrder = max(0, (int) ($body['minOrderCop'] ?? 0));

        if (strlen($code) < 3 || strlen($code) > 32 || !in_array($type, ['PERCENTAGE', 'FIXED_COP'], true) || $value <= 0) {
            throw new ApiException('VALIDATION_ERROR', 'Datos de cupón inválidos.', 422);
        }
        if ($type === 'PERCENTAGE' && $value > 90) {
            throw new ApiException('VALIDATION_ERROR', 'El descuento porcentual no puede superar el 90%.', 422);
        }

        $pdo = db();
        $exStmt = $pdo->prepare('SELECT id FROM coupons WHERE code = ? LIMIT 1');
        $exStmt->execute([$code]);
        $existingId = $exStmt->fetchColumn();

        if ($existingId) {
            $pdo->prepare(
                'UPDATE coupons SET description = ?, type = ?, value = ?, min_order_cop = ?, is_active = 1 WHERE id = ?'
            )->execute([$desc, $type, $value, $minOrder, $existingId]);
        } else {
            $id = generate_id('cpn');
            $pdo->prepare(
                'INSERT INTO coupons (id, code, description, type, value, min_order_cop, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)'
            )->execute([$id, $code, $desc, $type, $value, $minOrder]);
        }

        $stmt = $pdo->prepare('SELECT * FROM coupons WHERE code = ? LIMIT 1');
        $stmt->execute([$code]);
        $c = $stmt->fetch();

        write_audit_log($admin['id'], 'COUPON_UPSERTED', 'Coupon', (string) $c['id'], ['code' => $code]);

        api_success(['coupon' => [
            'id' => $c['id'],
            'code' => $c['code'],
            'description' => $c['description'],
            'type' => $c['type'],
            'value' => (int) $c['value'],
            'minOrderCop' => (int) $c['min_order_cop'],
            'isActive' => (bool) $c['is_active'],
        ]], 201);
    }

    public static function couponsPatch(): never
    {
        $admin = require_admin(true);
        $body = read_json_body();
        $id = trim((string) ($body['id'] ?? ''));
        $isActive = (bool) ($body['isActive'] ?? false);
        if ($id === '') {
            throw new ApiException('VALIDATION_ERROR', 'ID de cupón requerido.', 422);
        }

        db()->prepare('UPDATE coupons SET is_active = ? WHERE id = ?')->execute([$isActive ? 1 : 0, $id]);
        $stmt = db()->prepare('SELECT * FROM coupons WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $c = $stmt->fetch();
        if (!$c) {
            throw new ApiException('COUPON_NOT_FOUND', 'Cupón no encontrado.', 404);
        }

        write_audit_log($admin['id'], $isActive ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED', 'Coupon', $id, ['code' => $c['code']]);
        api_success(['coupon' => ['id' => $c['id'], 'code' => $c['code'], 'isActive' => (bool) $c['is_active']]]);
    }

    public static function validateCouponForSubtotal(string $code, int $subtotalCop): array
    {
        $clean = strtoupper(trim($code));
        $stmt = db()->prepare('SELECT * FROM coupons WHERE code = ? LIMIT 1');
        $stmt->execute([$clean]);
        $c = $stmt->fetch();
        $now = now_utc();

        if (!$c || (int) $c['is_active'] !== 1) {
            throw new ApiException('INVALID_COUPON', 'El cupón ingresado no existe o no está activo.', 404);
        }
        if ($c['starts_at'] !== null && $c['starts_at'] > $now) {
            throw new ApiException('COUPON_NOT_STARTED', 'Este cupón aún no está vigente.', 400);
        }
        if ($c['expires_at'] !== null && $c['expires_at'] <= $now) {
            throw new ApiException('COUPON_EXPIRED', 'Este cupón ya expiró.', 400);
        }
        if ($c['max_uses'] !== null && (int) $c['used_count'] >= (int) $c['max_uses']) {
            throw new ApiException('COUPON_EXHAUSTED', 'Este cupón alcanzó el límite de usos.', 400);
        }
        if ($subtotalCop < (int) $c['min_order_cop']) {
            throw new ApiException(
                'COUPON_MIN_ORDER',
                'El monto mínimo para usar este cupón es ' . email_format_cop((int) $c['min_order_cop']) . '.',
                400
            );
        }

        $discount = $c['type'] === 'PERCENTAGE'
            ? (int) round($subtotalCop * ((int) $c['value'] / 100))
            : min($subtotalCop, (int) $c['value']);

        return [
            'couponId' => (string) $c['id'],
            'code' => (string) $c['code'],
            'description' => (string) $c['description'],
            'type' => (string) $c['type'],
            'value' => (int) $c['value'],
            'discountCop' => max(0, $discount),
        ];
    }

    public static function couponsValidate(): never
    {
        $ip = extract_client_ip();
        enforce_rate_limit("coupon:validate:{$ip}", 20, 60);
        $body = read_json_body();
        $code = trim((string) ($body['code'] ?? ''));
        $subtotal = max(0, (int) ($body['subtotalCop'] ?? 0));
        if ($code === '') {
            throw new ApiException('VALIDATION_ERROR', 'Ingresa un código de descuento.', 422);
        }
        api_success(self::validateCouponForSubtotal($code, $subtotal));
    }

    public static function shippingQuote(): never
    {
        $body = read_json_body();
        $dept = trim((string) ($body['department'] ?? 'Santander'));
        $city = trim((string) ($body['city'] ?? 'Bucaramanga'));
        $subtotal = max(0, (int) ($body['subtotalCop'] ?? 0));
        api_success(calculate_shipping_quote($dept, $city, $subtotal));
    }
}
