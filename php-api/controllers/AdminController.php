<?php
declare(strict_types=1);

class AdminController
{
    public static function reportsGet(): never
    {
        require_admin(false);
        $pdo = db();

        $totalOrders = (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
        $paidStats = $pdo->query(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(total_cop), 0) AS rev, COALESCE(SUM(discount_cop), 0) AS disc, COALESCE(SUM(shipping_cop), 0) AS ship
             FROM orders WHERE status IN ('PAID','PROCESSING','SHIPPED','DELIVERED')"
        )->fetch();
        $pendingBreb = (int) $pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'PENDING_BREB_VERIFICATION'")->fetchColumn();
        $pendingDispatch = (int) $pdo->query("SELECT COUNT(*) FROM orders WHERE status IN ('PAID','PROCESSING')")->fetchColumn();
        $totalCustomers = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        $totalActiveProducts = (int) $pdo->query('SELECT COUNT(*) FROM products WHERE is_active = 1')->fetchColumn();

        $alertsRows = $pdo->query(
            'SELECT p.id, p.sku, p.name, c.name AS category_name, i.quantity_on_hand, i.quantity_reserved, i.low_stock_threshold
             FROM inventories i
             INNER JOIN products p ON p.id = i.product_id
             INNER JOIN categories c ON c.id = p.category_id
             WHERE (i.quantity_on_hand - i.quantity_reserved) <= i.low_stock_threshold
             ORDER BY (i.quantity_on_hand - i.quantity_reserved) ASC'
        )->fetchAll();

        $inventoryAlerts = array_map(static function (array $r): array {
            $avail = max(0, (int) $r['quantity_on_hand'] - (int) $r['quantity_reserved']);
            return [
                'productId' => $r['id'],
                'sku' => $r['sku'],
                'name' => $r['name'],
                'category' => $r['category_name'],
                'onHand' => (int) $r['quantity_on_hand'],
                'reserved' => (int) $r['quantity_reserved'],
                'available' => $avail,
                'threshold' => (int) $r['low_stock_threshold'],
                'status' => $avail <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
            ];
        }, $alertsRows);

        $topRows = $pdo->query(
            "SELECT oi.product_id, oi.product_name, oi.sku, SUM(oi.quantity) AS units_sold, SUM(oi.line_total) AS revenue_cop
             FROM order_items oi
             INNER JOIN orders o ON o.id = oi.order_id
             WHERE o.status IN ('PAID','PROCESSING','SHIPPED','DELIVERED')
             GROUP BY oi.product_id, oi.product_name, oi.sku
             ORDER BY revenue_cop DESC
             LIMIT 6"
        )->fetchAll();

        $topSelling = array_map(static fn (array $r): array => [
            'productId' => $r['product_id'],
            'productName' => $r['product_name'],
            'sku' => $r['sku'],
            'unitsSold' => (int) $r['units_sold'],
            'revenueCop' => (int) $r['revenue_cop'],
        ], $topRows);

        $coupons = array_map(static fn (array $c): array => [
            'id' => $c['id'],
            'code' => $c['code'],
            'description' => $c['description'],
            'type' => $c['type'],
            'value' => (int) $c['value'],
            'discountType' => $c['type'],
            'discountValue' => (int) $c['value'],
            'minOrderCop' => (int) $c['min_order_cop'],
            'minOrderAmount' => (int) $c['min_order_cop'],
            'usedCount' => (int) $c['used_count'],
            'isActive' => (bool) $c['is_active'],
        ], $pdo->query('SELECT * FROM coupons ORDER BY created_at DESC')->fetchAll());

        $auditRows = $pdo->query(
            'SELECT a.id, a.action, a.entity, a.created_at, u.name AS actor_name, u.email AS actor_email
             FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
             ORDER BY a.created_at DESC LIMIT 20'
        )->fetchAll();

        api_success([
            'metrics' => [
                'totalOrders' => $totalOrders,
                'confirmedOrdersCount' => (int) ($paidStats['cnt'] ?? 0),
                'totalRevenueCop' => (int) ($paidStats['rev'] ?? 0),
                'totalDiscountsCop' => (int) ($paidStats['disc'] ?? 0),
                'totalShippingCop' => (int) ($paidStats['ship'] ?? 0),
                'pendingBrebCount' => $pendingBreb,
                'pendingDispatchCount' => $pendingDispatch,
                'totalCustomers' => $totalCustomers,
                'totalActiveProducts' => $totalActiveProducts,
                'lowStockCount' => count($inventoryAlerts),
            ],
            'topSellingProducts' => $topSelling,
            'inventoryAlerts' => $inventoryAlerts,
            'coupons' => $coupons,
            'recentAuditLogs' => array_map(static fn (array $a): array => [
                'id' => $a['id'],
                'action' => $a['action'],
                'entity' => $a['entity'],
                'createdAt' => iso_date($a['created_at']),
                'actor' => $a['actor_email'] ? ['name' => $a['actor_name'], 'email' => $a['actor_email']] : null,
            ], $auditRows),
        ]);
    }

    public static function productsGet(): never
    {
        require_admin(false);
        $pdo = db();

        $prodRows = $pdo->query(
            'SELECT p.*, c.name AS category_name, b.name AS brand_name,
                    i.id AS inv_id, i.quantity_on_hand, i.quantity_reserved, i.low_stock_threshold
             FROM products p
             INNER JOIN categories c ON c.id = p.category_id
             INNER JOIN brands b ON b.id = p.brand_id
             LEFT JOIN inventories i ON i.product_id = p.id
             ORDER BY p.created_at DESC'
        )->fetchAll();

        $imgMap = [];
        foreach ($pdo->query('SELECT * FROM product_images ORDER BY is_primary DESC, sort_order ASC')->fetchAll() as $im) {
            $imgMap[$im['product_id']][] = [
                'id' => $im['id'],
                'url' => $im['url'],
                'isPrimary' => (bool) $im['is_primary'],
            ];
        }

        $varMap = [];
        foreach ($pdo->query('SELECT * FROM product_variants')->fetchAll() as $v) {
            $varMap[$v['product_id']][] = [
                'id' => $v['id'],
                'sku' => $v['sku'],
                'name' => $v['name'],
                'optionValue' => $v['option_value'],
            ];
        }

        $products = array_map(static function (array $p) use ($imgMap, $varMap): array {
            $price = (int) $p['price'];
            $compare = $p['compare_at_price'] !== null ? (int) $p['compare_at_price'] : null;
            return [
                'id' => $p['id'],
                'legacyId' => $p['legacy_id'] !== null ? (int) $p['legacy_id'] : null,
                'sku' => $p['sku'],
                'slug' => $p['slug'],
                'name' => $p['name'],
                'tag' => $p['tag'],
                'description' => $p['description'],
                'price' => $price,
                'compareAtPrice' => $compare,
                'discountPercent' => ($compare !== null && $compare > $price)
                    ? (int) round((($compare - $price) / $compare) * 100)
                    : null,
                'badge' => $p['tag'],
                'isActive' => (bool) $p['is_active'],
                'isFeatured' => (bool) $p['is_featured'],
                'isNew' => (bool) $p['is_new'],
                'isOffer' => (bool) $p['is_offer'] || ($compare !== null && $compare > $price),
                'category' => ['id' => $p['category_id'], 'name' => $p['category_name']],
                'brand' => ['id' => $p['brand_id'], 'name' => $p['brand_name']],
                'images' => $imgMap[$p['id']] ?? [],
                'variants' => $varMap[$p['id']] ?? [],
                'inventory' => $p['inv_id'] ? [
                    'id' => $p['inv_id'],
                    'quantityOnHand' => (int) $p['quantity_on_hand'],
                    'quantityReserved' => (int) $p['quantity_reserved'],
                    'lowStockThreshold' => (int) $p['low_stock_threshold'],
                ] : null,
            ];
        }, $prodRows);

        $categories = array_map(static fn (array $c): array => [
            'id' => $c['id'],
            'name' => $c['name'],
            'slug' => $c['slug'],
            'description' => $c['description'],
            'imageUrl' => $c['image_url'],
            'isActive' => (bool) $c['is_active'],
        ], $pdo->query('SELECT * FROM categories ORDER BY sort_order ASC, name ASC')->fetchAll());

        $brands = array_map(static fn (array $b): array => [
            'id' => $b['id'],
            'name' => $b['name'],
            'slug' => $b['slug'],
            'description' => $b['description'],
            'logoUrl' => $b['logo_url'],
            'isActive' => (bool) $b['is_active'],
        ], $pdo->query('SELECT * FROM brands ORDER BY name ASC')->fetchAll());

        api_success(['products' => $products, 'categories' => $categories, 'brands' => $brands]);
    }

    private static function assertCatalogMedia(?string $url): ?string
    {
        if ($url === null || trim($url) === '') {
            return null;
        }
        $clean = trim($url);
        if (!is_safe_media_url($clean, true, true)) {
            throw new ApiException('VALIDATION_ERROR', 'Imagen no permitida. Sube un archivo PNG, JPG o WebP válido.', 422);
        }
        return $clean;
    }

    public static function productsPost(): never
    {
        $admin = require_admin(true);
        $b = read_json_body();
        $entityType = (string) ($b['entityType'] ?? 'PRODUCT');
        $pdo = db();

        if ($entityType === 'CATEGORY') {
            $name = assert_no_html((string) ($b['name'] ?? ''), 'Nombre de categoría');
            $desc = isset($b['description']) ? assert_no_html((string) $b['description'], 'Descripción') : null;
            $img = self::assertCatalogMedia(isset($b['imageUrl']) ? (string) $b['imageUrl'] : null);
            if (mb_strlen($name) < 2) {
                throw new ApiException('VALIDATION_ERROR', 'Nombre de categoría inválido.', 422);
            }
            $id = generate_id('cat');
            $slug = to_slug($name);
            $pdo->prepare('INSERT INTO categories (id, name, slug, description, image_url, is_active) VALUES (?, ?, ?, ?, ?, 1)')
                ->execute([$id, $name, $slug, $desc, $img]);
            write_audit_log($admin['id'], 'ADMIN_CATEGORY_CREATED', 'Category', $id, ['name' => $name]);
            api_success(['category' => ['id' => $id, 'name' => $name, 'slug' => $slug, 'description' => $desc, 'imageUrl' => $img]], 201);
        }

        if ($entityType === 'UPDATE_CATEGORY') {
            self::updateCategoryInternal($b, $admin['id']);
        }

        if ($entityType === 'BRAND') {
            $name = assert_no_html((string) ($b['name'] ?? ''), 'Nombre de marca');
            $desc = isset($b['description']) ? assert_no_html((string) $b['description'], 'Descripción') : null;
            $logo = self::assertCatalogMedia(isset($b['logoUrl']) ? (string) $b['logoUrl'] : null);
            if (mb_strlen($name) < 2) {
                throw new ApiException('VALIDATION_ERROR', 'Nombre de marca inválido.', 422);
            }
            $id = generate_id('brd');
            $slug = to_slug($name);
            $pdo->prepare('INSERT INTO brands (id, name, slug, description, logo_url, is_active) VALUES (?, ?, ?, ?, ?, 1)')
                ->execute([$id, $name, $slug, $desc, $logo]);
            write_audit_log($admin['id'], 'ADMIN_BRAND_CREATED', 'Brand', $id, ['name' => $name]);
            api_success(['brand' => ['id' => $id, 'name' => $name, 'slug' => $slug, 'description' => $desc, 'logoUrl' => $logo]], 201);
        }

        if ($entityType === 'UPDATE_BRAND') {
            $id = trim((string) ($b['id'] ?? ''));
            $name = assert_no_html((string) ($b['name'] ?? ''), 'Nombre de marca');
            $desc = isset($b['description']) ? assert_no_html((string) $b['description'], 'Descripción') : null;
            $logo = self::assertCatalogMedia(isset($b['logoUrl']) ? (string) $b['logoUrl'] : null);
            if ($id === '' || mb_strlen($name) < 2) {
                throw new ApiException('VALIDATION_ERROR', 'Datos de marca inválidos.', 422);
            }
            $slug = to_slug($name);
            $pdo->prepare('UPDATE brands SET name = ?, slug = ?, description = ?, logo_url = ? WHERE id = ?')
                ->execute([$name, $slug, $desc, $logo, $id]);
            write_audit_log($admin['id'], 'ADMIN_BRAND_UPDATED', 'Brand', $id, ['name' => $name]);
            api_success(['brand' => ['id' => $id, 'name' => $name, 'slug' => $slug, 'description' => $desc, 'logoUrl' => $logo]]);
        }

        if ($entityType === 'BULK_EXCEL') {
            $rows = $b['rows'] ?? [];
            if (!is_array($rows) || count($rows) === 0 || count($rows) > 200) {
                throw new ApiException('VALIDATION_ERROR', 'Proporciona entre 1 y 200 filas válidas.', 422);
            }
            $created = 0;
            $updated = 0;
            $pdo->beginTransaction();
            try {
                foreach ($rows as $r) {
                    $sku = strtoupper(trim((string) ($r['sku'] ?? '')));
                    $name = assert_no_html((string) ($r['name'] ?? ''), 'Nombre');
                    $price = (int) ($r['price'] ?? 0);
                    $compare = isset($r['compareAtPrice']) && (int) $r['compareAtPrice'] > 0 ? (int) $r['compareAtPrice'] : null;
                    $stock = max(0, (int) ($r['stock'] ?? 10));
                    $catName = assert_no_html((string) ($r['categoryName'] ?? 'Accesorios'), 'Categoría');
                    $brandName = assert_no_html((string) ($r['brandName'] ?? 'LOGITECH G'), 'Marca');
                    $imgUrl = self::assertCatalogMedia((string) ($r['imageUrl'] ?? '/images/g502x-plus-gallery-1-black.png'))
                        ?: '/images/g502x-plus-gallery-1-black.png';
                    $desc = assert_no_html((string) ($r['description'] ?? "{$name} original con garantía en Colombia."), 'Descripción');
                    $varName = assert_no_html((string) ($r['variantName'] ?? 'Estándar'), 'Variante');

                    if (strlen($sku) < 2 || mb_strlen($name) < 2 || $price <= 0) {
                        continue;
                    }

                    // Asegurar categoría
                    $cStmt = $pdo->prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) LIMIT 1');
                    $cStmt->execute([$catName]);
                    $catId = $cStmt->fetchColumn();
                    if (!$catId) {
                        $catId = generate_id('cat');
                        $pdo->prepare('INSERT INTO categories (id, name, slug, is_active) VALUES (?, ?, ?, 1)')
                            ->execute([$catId, $catName, to_slug($catName)]);
                    }

                    // Asegurar marca
                    $bStmt = $pdo->prepare('SELECT id FROM brands WHERE LOWER(name) = LOWER(?) LIMIT 1');
                    $bStmt->execute([$brandName]);
                    $brandId = $bStmt->fetchColumn();
                    if (!$brandId) {
                        $brandId = generate_id('brd');
                        $pdo->prepare('INSERT INTO brands (id, name, slug, is_active) VALUES (?, ?, ?, 1)')
                            ->execute([$brandId, $brandName, to_slug($brandName)]);
                    }

                    $isOffer = ($compare !== null && $compare > $price) ? 1 : 0;
                    $exStmt = $pdo->prepare('SELECT id FROM products WHERE sku = ? LIMIT 1');
                    $exStmt->execute([$sku]);
                    $existingId = $exStmt->fetchColumn();

                    if ($existingId) {
                        $pdo->prepare(
                            'UPDATE products SET name = ?, description = ?, price = ?, compare_at_price = ?, is_offer = ?, category_id = ?, brand_id = ?, is_active = 1
                             WHERE id = ?'
                        )->execute([$name, $desc, $price, $compare, $isOffer, $catId, $brandId, $existingId]);
                        $pdo->prepare('UPDATE inventories SET quantity_on_hand = ? WHERE product_id = ?')->execute([$stock, $existingId]);
                        $updated++;
                    } else {
                        $pid = generate_id('prd');
                        $slug = to_slug($name) . '-' . strtolower(bin2hex(random_bytes(2)));
                        $pdo->prepare(
                            "INSERT INTO products (id, sku, name, slug, description, price, compare_at_price, specs, is_offer, is_active, category_id, brand_id)
                             VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, 1, ?, ?)"
                        )->execute([$pid, $sku, $name, $slug, $desc, $price, $compare, $isOffer, $catId, $brandId]);
                        $pdo->prepare('INSERT INTO product_images (id, product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, 0, 1)')
                            ->execute([generate_id('img'), $pid, $imgUrl, $name]);
                        $pdo->prepare('INSERT INTO product_variants (id, product_id, sku, name, option_value, is_active) VALUES (?, ?, ?, ?, ?, 1)')
                            ->execute([generate_id('var'), $pid, $sku . '-V1', $varName, $varName]);
                        $pdo->prepare('INSERT INTO inventories (id, product_id, quantity_on_hand, quantity_reserved, low_stock_threshold) VALUES (?, ?, ?, 0, 5)')
                            ->execute([generate_id('inv'), $pid, $stock]);
                        $created++;
                    }
                }
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            write_audit_log($admin['id'], 'ADMIN_BULK_EXCEL_UPSERT', 'Product', 'BULK', ['created' => $created, 'updated' => $updated]);
            api_success(['createdCount' => $created, 'updatedCount' => $updated], 201);
        }

        // Crear producto individual
        $sku = strtoupper(trim((string) ($b['sku'] ?? 'BSP-' . random_int(1000, 9999))));
        $name = assert_no_html((string) ($b['name'] ?? ''), 'Nombre del producto');
        $desc = assert_no_html((string) ($b['description'] ?? ''), 'Descripción');
        $price = (int) ($b['price'] ?? 0);
        $compare = isset($b['compareAtPrice']) && (int) $b['compareAtPrice'] > 0 ? (int) $b['compareAtPrice'] : null;
        $catId = trim((string) ($b['categoryId'] ?? ''));
        $brandId = trim((string) ($b['brandId'] ?? ''));
        $imgUrl = self::assertCatalogMedia((string) ($b['imageUrl'] ?? '/images/g502x-plus-gallery-1-black.png'))
            ?: '/images/g502x-plus-gallery-1-black.png';
        $stock = max(0, (int) ($b['initialStock'] ?? 10));
        $isOffer = ($compare !== null && $compare > $price) ? 1 : 0;

        if (mb_strlen($name) < 3 || mb_strlen($desc) < 10 || $price <= 0 || $catId === '' || $brandId === '') {
            throw new ApiException('VALIDATION_ERROR', 'Completa nombre, descripción, precio, categoría y marca.', 422);
        }

        $pid = generate_id('prd');
        $slug = to_slug($name) . '-' . strtolower(bin2hex(random_bytes(2)));
        $maxLegacy = (int) $pdo->query('SELECT COALESCE(MAX(legacy_id), 10) FROM products')->fetchColumn();
        $legacyId = $maxLegacy + 1;

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "INSERT INTO products (id, legacy_id, sku, name, slug, description, price, compare_at_price, specs, is_featured, is_new, is_offer, is_active, category_id, brand_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 1, ?, 1, ?, ?)"
            )->execute([$pid, $legacyId, $sku, $name, $slug, $desc, $price, $compare, !empty($b['isFeatured']) ? 1 : 0, $isOffer, $catId, $brandId]);

            $pdo->prepare('INSERT INTO product_images (id, product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, 0, 1)')
                ->execute([generate_id('img'), $pid, $imgUrl, $name]);

            $variants = is_array($b['variants'] ?? null) && count($b['variants']) > 0
                ? $b['variants']
                : [['name' => 'Negro', 'sku' => "{$sku}-V1", 'optionValue' => 'Negro']];
            foreach ($variants as $v) {
                $pdo->prepare('INSERT INTO product_variants (id, product_id, sku, name, option_value, is_active) VALUES (?, ?, ?, ?, ?, 1)')
                    ->execute([generate_id('var'), $pid, (string) ($v['sku'] ?? "{$sku}-V1"), (string) ($v['name'] ?? 'Estándar'), (string) ($v['optionValue'] ?? 'Estándar')]);
            }

            $pdo->prepare('INSERT INTO inventories (id, product_id, quantity_on_hand, quantity_reserved, low_stock_threshold) VALUES (?, ?, ?, 0, 5)')
                ->execute([generate_id('inv'), $pid, $stock]);

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        write_audit_log($admin['id'], 'ADMIN_PRODUCT_CREATED', 'Product', $pid, ['sku' => $sku, 'name' => $name]);
        api_success(['product' => ['id' => $pid, 'sku' => $sku, 'name' => $name, 'slug' => $slug, 'price' => $price]], 201);
    }

    private static function updateCategoryInternal(array $b, string $actorId): never
    {
        $id = trim((string) ($b['id'] ?? ''));
        $name = assert_no_html((string) ($b['name'] ?? ''), 'Nombre de categoría');
        $desc = isset($b['description']) ? assert_no_html((string) $b['description'], 'Descripción') : null;
        $img = self::assertCatalogMedia(isset($b['imageUrl']) ? (string) $b['imageUrl'] : null);
        if ($id === '' || mb_strlen($name) < 2) {
            throw new ApiException('VALIDATION_ERROR', 'Datos de categoría inválidos.', 422);
        }
        $slug = to_slug($name);
        db()->prepare('UPDATE categories SET name = ?, slug = ?, description = ?, image_url = ? WHERE id = ?')
            ->execute([$name, $slug, $desc, $img, $id]);
        write_audit_log($actorId, 'ADMIN_CATEGORY_UPDATED', 'Category', $id, ['name' => $name]);
        api_success(['category' => ['id' => $id, 'name' => $name, 'slug' => $slug, 'description' => $desc, 'imageUrl' => $img]]);
    }

    public static function productsPatch(): never
    {
        $admin = require_admin(true);
        self::updateCategoryInternal(read_json_body(), $admin['id']);
    }

    public static function productByIdPatch(string $productId): never
    {
        $admin = require_admin(true);
        $b = read_json_body();
        $pdo = db();

        $curStmt = $pdo->prepare('SELECT * FROM products WHERE id = ? LIMIT 1');
        $curStmt->execute([$productId]);
        $cur = $curStmt->fetch();
        if (!$cur) {
            throw new ApiException('PRODUCT_NOT_FOUND', 'Producto no encontrado.', 404);
        }

        $name = array_key_exists('name', $b) ? assert_no_html((string) $b['name'], 'Nombre') : (string) $cur['name'];
        $desc = array_key_exists('description', $b) ? assert_no_html((string) $b['description'], 'Descripción') : (string) $cur['description'];
        $price = array_key_exists('price', $b) ? (int) $b['price'] : (int) $cur['price'];
        $compare = array_key_exists('compareAtPrice', $b)
            ? ($b['compareAtPrice'] !== null && (int) $b['compareAtPrice'] > 0 ? (int) $b['compareAtPrice'] : null)
            : ($cur['compare_at_price'] !== null ? (int) $cur['compare_at_price'] : null);
        $catId = array_key_exists('categoryId', $b) ? trim((string) $b['categoryId']) : (string) $cur['category_id'];
        $brandId = array_key_exists('brandId', $b) ? trim((string) $b['brandId']) : (string) $cur['brand_id'];
        $isActive = array_key_exists('isActive', $b) ? ((bool) $b['isActive'] ? 1 : 0) : (int) $cur['is_active'];
        $isOffer = ($compare !== null && $compare > $price) ? 1 : 0;

        $pdo->prepare(
            'UPDATE products SET name = ?, description = ?, price = ?, compare_at_price = ?, is_offer = ?, category_id = ?, brand_id = ?, is_active = ?
             WHERE id = ?'
        )->execute([$name, $desc, $price, $compare, $isOffer, $catId, $brandId, $isActive, $productId]);

        if (array_key_exists('stockQuantity', $b)) {
            $pdo->prepare('UPDATE inventories SET quantity_on_hand = ? WHERE product_id = ?')
                ->execute([max(0, (int) $b['stockQuantity']), $productId]);
        }
        if (array_key_exists('imageUrl', $b) && trim((string) $b['imageUrl']) !== '') {
            $img = self::assertCatalogMedia((string) $b['imageUrl']);
            $updImg = $pdo->prepare('UPDATE product_images SET url = ? WHERE product_id = ? AND is_primary = 1');
            $updImg->execute([$img, $productId]);
            if ($updImg->rowCount() === 0) {
                $pdo->prepare('INSERT INTO product_images (id, product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, 0, 1)')
                    ->execute([generate_id('img'), $productId, $img, $name]);
            }
        }

        write_audit_log($admin['id'], 'ADMIN_PRODUCT_UPDATED', 'Product', $productId, ['name' => $name, 'price' => $price, 'isActive' => (bool) $isActive]);
        api_success(['product' => ['id' => $productId, 'name' => $name, 'price' => $price, 'isActive' => (bool) $isActive]]);
    }

    public static function productByIdDelete(string $productId): never
    {
        $admin = require_admin(true);
        db()->prepare('UPDATE products SET is_active = 0 WHERE id = ?')->execute([$productId]);
        write_audit_log($admin['id'], 'ADMIN_PRODUCT_DEACTIVATED', 'Product', $productId);
        api_success(['deactivatedId' => $productId]);
    }

    public static function offersGet(): never
    {
        require_admin(false);
        $pdo = db();
        $offers = $pdo->query(
            'SELECT p.id, p.sku, p.name, p.price, p.compare_at_price, c.id AS cid, c.name AS cname, b.id AS bid, b.name AS bname
             FROM products p INNER JOIN categories c ON c.id = p.category_id INNER JOIN brands b ON b.id = p.brand_id
             WHERE p.is_offer = 1 ORDER BY p.updated_at DESC'
        )->fetchAll();

        $campaigns = $pdo->query('SELECT * FROM discounts WHERE is_active = 1 ORDER BY created_at DESC LIMIT 30')->fetchAll();

        api_success([
            'offers' => array_map(static fn (array $o): array => [
                'id' => $o['id'],
                'sku' => $o['sku'],
                'name' => $o['name'],
                'price' => (int) $o['price'],
                'compareAtPrice' => $o['compare_at_price'] !== null ? (int) $o['compare_at_price'] : null,
                'discountPercent' => ($o['compare_at_price'] && (int) $o['compare_at_price'] > (int) $o['price'])
                    ? (int) round((((int) $o['compare_at_price'] - (int) $o['price']) / (int) $o['compare_at_price']) * 100)
                    : 0,
                'category' => ['id' => $o['cid'], 'name' => $o['cname']],
                'brand' => ['id' => $o['bid'], 'name' => $o['bname']],
            ], $offers),
            'campaigns' => $campaigns,
        ]);
    }

    public static function applyOffersScope(array $b, string $actorId): array
    {
        $norm = static function (mixed $v): ?string {
            $s = trim((string) ($v ?? ''));
            return ($s === '' || $s === 'ALL' || $s === 'Todas' || $s === 'Todos') ? null : $s;
        };
        $catId = $norm($b['categoryId'] ?? null);
        $brandId = $norm($b['brandId'] ?? null);
        $prodId = $norm($b['productId'] ?? null);
        $pct = (int) ($b['discountPercent'] ?? 0);

        if ($pct < 0 || $pct > 90) {
            throw new ApiException('VALIDATION_ERROR', 'El porcentaje de descuento debe estar entre 0 y 90.', 422);
        }

        $nowTs = time();
        $startsAtStr = !empty($b['startsAt']) ? trim((string) $b['startsAt']) : null;
        $expiresAtStr = !empty($b['expiresAt']) ? trim((string) $b['expiresAt']) : (!empty($b['endsAt']) ? trim((string) $b['endsAt']) : null);
        $startsTs = $startsAtStr ? strtotime($startsAtStr) : null;
        $expiresTs = $expiresAtStr ? strtotime($expiresAtStr) : null;

        if (($startsAtStr && $startsTs === false) || ($expiresAtStr && $expiresTs === false)) {
            throw new ApiException('VALIDATION_ERROR', 'Fecha de oferta inválida.', 422);
        }
        if ($startsTs && $expiresTs && $expiresTs <= $startsTs) {
            throw new ApiException('INVALID_OFFER_SCHEDULE', 'La fecha de fin debe ser posterior a la fecha de inicio.', 400);
        }
        if ($pct > 0 && $expiresTs && $expiresTs <= $nowTs) {
            throw new ApiException('INVALID_OFFER_SCHEDULE', 'La fecha de fin no puede estar en el pasado.', 400);
        }

        $pdo = db();
        $where = [];
        $params = [];
        if ($catId) {
            $where[] = 'category_id = ?';
            $params[] = $catId;
        }
        if ($brandId) {
            $where[] = 'brand_id = ?';
            $params[] = $brandId;
        }
        if ($prodId) {
            $where[] = 'id = ?';
            $params[] = $prodId;
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $stmt = $pdo->prepare("SELECT id, sku, name, price, compare_at_price, is_offer FROM products {$whereSql}");
        $stmt->execute($params);
        $matched = $stmt->fetchAll();
        if (!$matched) {
            throw new ApiException('NO_MATCHING_PRODUCTS', 'No se encontraron productos para el alcance seleccionado.', 404);
        }

        $scope = $prodId ? 'PRODUCT' : (($catId && $brandId) ? 'CATEGORY_BRAND' : ($catId ? 'CATEGORY' : ($brandId ? 'BRAND' : 'ALL')));
        $isRemoving = $pct === 0;
        $isFuture = !$isRemoving && $startsTs !== null && $startsTs > $nowTs;
        $campaignId = null;

        $pdo->beginTransaction();
        try {
            if ($isRemoving) {
                $dWhere = ['is_active = 1'];
                $dParams = [];
                if ($prodId) {
                    $dWhere[] = 'product_id = ?';
                    $dParams[] = $prodId;
                } else {
                    if ($catId) {
                        $dWhere[] = 'category_id = ?';
                        $dParams[] = $catId;
                    }
                    if ($brandId) {
                        $dWhere[] = 'brand_id = ?';
                        $dParams[] = $brandId;
                    }
                }
                $pdo->prepare('UPDATE discounts SET is_active = 0 WHERE ' . implode(' AND ', $dWhere))->execute($dParams);
            } else {
                $campaignId = generate_id('dsc');
                $campName = trim((string) ($b['campaignName'] ?? '')) ?: "Campaña {$pct}% OFF ({$scope})";
                $pdo->prepare(
                    "INSERT INTO discounts (id, name, type, value, target_scope, product_id, category_id, brand_id, starts_at, expires_at, is_active)
                     VALUES (?, ?, 'PERCENTAGE', ?, ?, ?, ?, ?, ?, ?, 1)"
                )->execute([
                    $campaignId,
                    $campName,
                    $pct,
                    $scope,
                    $scope === 'PRODUCT' ? $prodId : null,
                    in_array($scope, ['CATEGORY', 'CATEGORY_BRAND'], true) ? $catId : null,
                    in_array($scope, ['BRAND', 'CATEGORY_BRAND'], true) ? $brandId : null,
                    $startsTs ? gmdate('Y-m-d H:i:s', $startsTs) : null,
                    $expiresTs ? gmdate('Y-m-d H:i:s', $expiresTs) : null,
                ]);
            }

            if (!$isFuture) {
                foreach ($matched as $p) {
                    $price = (int) $p['price'];
                    $compare = $p['compare_at_price'] !== null ? (int) $p['compare_at_price'] : null;
                    if ($isRemoving) {
                        $restored = ($compare !== null && $compare > $price) ? $compare : $price;
                        $pdo->prepare('UPDATE products SET price = ?, compare_at_price = NULL, is_offer = 0 WHERE id = ?')
                            ->execute([$restored, $p['id']]);
                    } else {
                        $base = ($compare !== null && $compare > $price) ? $compare : $price;
                        $disc = max(1, (int) round($base * (1 - $pct / 100)));
                        $pdo->prepare('UPDATE products SET price = ?, compare_at_price = ?, is_offer = 1 WHERE id = ?')
                            ->execute([$disc, $base, $p['id']]);
                    }
                }
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        write_audit_log($actorId, $isRemoving ? 'ADMIN_OFFER_REMOVED' : ($isFuture ? 'ADMIN_OFFER_SCHEDULED' : 'ADMIN_OFFER_APPLIED'), 'Discount', $campaignId ?? 'SCOPE', [
            'targetScope' => $scope,
            'discountPercent' => $pct,
            'affectedCount' => count($matched),
        ]);

        return [
            'action' => $isRemoving ? 'REMOVED' : ($isFuture ? 'SCHEDULED' : 'APPLIED'),
            'scheduledForFuture' => $isFuture,
            'discountPercent' => $pct,
            'affectedCount' => count($matched),
            'scope' => ['targetScope' => $scope, 'categoryId' => $catId ?? 'ALL', 'brandId' => $brandId ?? 'ALL', 'productId' => $prodId ?? 'ALL'],
        ];
    }

    public static function offersPost(): never
    {
        $admin = require_admin(true);
        api_success(self::applyOffersScope(read_json_body(), $admin['id']));
    }

    public static function offersDelete(): never
    {
        $admin = require_admin(true);
        $b = read_json_body();
        $b['discountPercent'] = 0;
        api_success(self::applyOffersScope($b, $admin['id']));
    }

    public static function inventoryPost(): never
    {
        $admin = require_admin(false);
        $b = read_json_body();
        $productId = trim((string) ($b['productId'] ?? ''));
        $type = strtoupper(trim((string) ($b['type'] ?? 'IN')));
        $qty = max(0, (int) ($b['quantity'] ?? 0));
        $reason = assert_no_html((string) ($b['reason'] ?? 'Ajuste de inventario'), 'Motivo');

        if ($productId === '' || !in_array($type, ['IN', 'OUT', 'ADJUSTMENT'], true)) {
            throw new ApiException('VALIDATION_ERROR', 'Datos de movimiento de inventario inválidos.', 422);
        }

        $pdo = db();
        $stmt = $pdo->prepare('SELECT * FROM inventories WHERE product_id = ? LIMIT 1');
        $stmt->execute([$productId]);
        $inv = $stmt->fetch();
        if (!$inv) {
            throw new ApiException('INVENTORY_NOT_FOUND', 'Inventario no encontrado.', 404);
        }

        $onHand = (int) $inv['quantity_on_hand'];
        $reserved = (int) $inv['quantity_reserved'];
        $next = $onHand;
        if ($type === 'IN') {
            $next = $onHand + $qty;
        } elseif ($type === 'OUT') {
            if ($onHand - $qty < $reserved) {
                throw new ApiException('INVALID_STOCK_REDUCTION', 'No puedes retirar más unidades de las disponibles sin reservar.', 409);
            }
            $next = $onHand - $qty;
        } else {
            if ($qty < $reserved) {
                throw new ApiException('INVALID_STOCK_ADJUSTMENT', 'El stock físico no puede ser menor a las unidades reservadas.', 409);
            }
            $next = $qty;
        }

        $pdo->prepare('UPDATE inventories SET quantity_on_hand = ? WHERE id = ?')->execute([$next, $inv['id']]);
        $pdo->prepare(
            'INSERT INTO inventory_movements (id, inventory_id, type, quantity, reason, created_by_id) VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([generate_id('mov'), $inv['id'], $type, $qty, $reason, $admin['id']]);

        write_audit_log($admin['id'], 'ADMIN_INVENTORY_ADJUSTED', 'Inventory', (string) $inv['id'], ['type' => $type, 'newOnHand' => $next]);
        api_success(['inventory' => ['id' => $inv['id'], 'quantityOnHand' => $next]]);
    }

    public static function ordersGet(): never
    {
        require_admin(false);
        $pdo = db();
        $where = [];
        $params = [];

        $status = trim((string) ($_GET['status'] ?? ''));
        if ($status !== '' && $status !== 'ALL') {
            $where[] = 'status = ?';
            $params[] = $status;
        }
        $search = trim((string) ($_GET['search'] ?? ''));
        if ($search !== '') {
            $like = '%' . $search . '%';
            $where[] = '(order_number LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?)';
            array_push($params, $like, $like, $like);
        }

        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
        $stmt = $pdo->prepare("SELECT * FROM orders {$whereSql} ORDER BY created_at DESC LIMIT 100");
        $stmt->execute($params);
        $orders = array_map([OrderController::class, 'hydrateOrder'], $stmt->fetchAll());
        $carriers = $pdo->query('SELECT id, name, code FROM carriers WHERE is_active = 1 ORDER BY name ASC')->fetchAll();

        api_success(['orders' => $orders, 'carriers' => $carriers]);
    }

    public static function ordersPatch(): never
    {
        $admin = require_admin(false);
        $b = read_json_body();
        $orderId = trim((string) ($b['orderId'] ?? ''));
        $action = (string) ($b['action'] ?? 'UPDATE_STATUS_AND_SHIPMENT');

        $pdo = db();
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? LIMIT 1');
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if (!$order) {
            throw new ApiException('ORDER_NOT_FOUND', 'Pedido no encontrado.', 404);
        }

        if ($action === 'VERIFY_BREB_PAYMENT') {
            $pdo->beginTransaction();
            try {
                $its = $pdo->prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?');
                $its->execute([$orderId]);
                foreach ($its->fetchAll() as $it) {
                    $inv = $pdo->prepare('SELECT id, quantity_on_hand, quantity_reserved FROM inventories WHERE product_id = ? FOR UPDATE');
                    $inv->execute([$it['product_id']]);
                    $ir = $inv->fetch();
                    if ($ir) {
                        $pdo->prepare('UPDATE inventories SET quantity_on_hand = ?, quantity_reserved = ? WHERE id = ?')
                            ->execute([max(0, (int) $ir['quantity_on_hand'] - (int) $it['quantity']), max(0, (int) $ir['quantity_reserved'] - (int) $it['quantity']), $ir['id']]);
                    }
                }
                $pdo->prepare("UPDATE payments SET status = 'APPROVED', verified_at = ? WHERE order_id = ?")->execute([now_utc(), $orderId]);
                $pdo->prepare("UPDATE orders SET status = 'PAID' WHERE id = ?")->execute([$orderId]);
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            write_audit_log($admin['id'], 'ADMIN_BREB_PAYMENT_VERIFIED', 'Order', $orderId);
        } elseif ($action === 'REJECT_BREB_PAYMENT') {
            $pdo->beginTransaction();
            try {
                $its = $pdo->prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?');
                $its->execute([$orderId]);
                foreach ($its->fetchAll() as $it) {
                    $inv = $pdo->prepare('SELECT id, quantity_reserved FROM inventories WHERE product_id = ? FOR UPDATE');
                    $inv->execute([$it['product_id']]);
                    $ir = $inv->fetch();
                    if ($ir) {
                        $pdo->prepare('UPDATE inventories SET quantity_reserved = ? WHERE id = ?')
                            ->execute([max(0, (int) $ir['quantity_reserved'] - (int) $it['quantity']), $ir['id']]);
                    }
                }
                $pdo->prepare("UPDATE payments SET status = 'DECLINED' WHERE order_id = ?")->execute([$orderId]);
                $pdo->prepare("UPDATE orders SET status = 'CANCELLED' WHERE id = ?")->execute([$orderId]);
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            write_audit_log($admin['id'], 'ADMIN_BREB_PAYMENT_REJECTED', 'Order', $orderId);
        } else {
            $nextStatus = (string) ($b['status'] ?? $order['status']);
            $carrierId = array_key_exists('carrierId', $b) ? ($b['carrierId'] ?: null) : null;
            $tracking = array_key_exists('trackingNumber', $b) ? (trim((string) ($b['trackingNumber'] ?? '')) ?: null) : null;

            $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$nextStatus, $orderId]);
            $shipStatus = $nextStatus === 'SHIPPED' ? 'IN_TRANSIT' : ($nextStatus === 'DELIVERED' ? 'DELIVERED' : 'PENDING');
            $pdo->prepare(
                'UPDATE shipments SET carrier_id = COALESCE(?, carrier_id), tracking_number = ?, status = ?,
                 shipped_at = IF(? = "IN_TRANSIT" AND shipped_at IS NULL, NOW(), shipped_at),
                 delivered_at = IF(? = "DELIVERED" AND delivered_at IS NULL, NOW(), delivered_at)
                 WHERE order_id = ?'
            )->execute([$carrierId, $tracking, $shipStatus, $shipStatus, $shipStatus, $orderId]);

            write_audit_log($admin['id'], 'ADMIN_ORDER_UPDATED', 'Order', $orderId, ['status' => $nextStatus, 'trackingNumber' => $tracking]);

            if ($nextStatus === 'SHIPPED' && $tracking) {
                $cName = 'Transportadora BSP';
                if ($carrierId) {
                    $cStmt = $pdo->prepare('SELECT name FROM carriers WHERE id = ? LIMIT 1');
                    $cStmt->execute([$carrierId]);
                    $cName = (string) ($cStmt->fetchColumn() ?: $cName);
                }
                send_shipment_dispatched_email($order, $cName, $tracking);
            }
        }

        $stmt->execute([$orderId]);
        api_success(['order' => OrderController::hydrateOrder($stmt->fetch())]);
    }

    public static function customersGet(): never
    {
        require_admin(true);
        $rows = db()->query(
            "SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at, r.code AS role_code,
                    (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
                    (SELECT COALESCE(SUM(o.total_cop), 0) FROM orders o WHERE o.user_id = u.id AND o.status != 'CANCELLED') AS total_spent
             FROM users u INNER JOIN roles r ON r.id = u.role_id
             ORDER BY u.created_at DESC"
        )->fetchAll();

        api_success([
            'customers' => array_map(static fn (array $u): array => [
                'id' => $u['id'],
                'fullName' => $u['name'],
                'email' => $u['email'],
                'phone' => $u['phone'],
                'isActive' => (bool) $u['is_active'],
                'role' => $u['role_code'],
                'roleName' => role_label_es((string) $u['role_code']),
                'roleLabel' => role_label_es((string) $u['role_code']),
                'ordersCount' => (int) $u['orders_count'],
                'totalSpentCop' => (int) $u['total_spent'],
                'createdAt' => iso_date($u['created_at']),
            ], $rows),
        ]);
    }

    public static function customersPatch(): never
    {
        $admin = require_admin(true);
        $b = read_json_body();
        $userId = trim((string) ($b['userId'] ?? ''));
        $role = isset($b['role']) ? strtoupper(trim((string) $b['role'])) : null;
        $isActive = array_key_exists('isActive', $b) ? (bool) $b['isActive'] : null;

        if ($userId === '' || ($role !== null && !in_array($role, ['CUSTOMER', 'STAFF', 'ADMIN'], true))) {
            throw new ApiException('VALIDATION_ERROR', 'Usuario o rol inválido.', 422);
        }

        if ($userId === $admin['id'] && (($role !== null && $role !== 'ADMIN') || $isActive === false)) {
            throw new ApiException(
                'SELF_DEMOTION_FORBIDDEN',
                'No puedes quitar tus propios privilegios de administrador ni desactivar tu propia cuenta.',
                400
            );
        }

        $pdo = db();
        $curStmt = $pdo->prepare('SELECT u.*, r.code AS role_code FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1');
        $curStmt->execute([$userId]);
        $target = $curStmt->fetch();
        if (!$target) {
            throw new ApiException('USER_NOT_FOUND', 'Usuario no encontrado.', 404);
        }

        $nextRoleId = (string) $target['role_id'];
        $roleChanged = $role !== null && $role !== $target['role_code'];
        if ($roleChanged) {
            $rStmt = $pdo->prepare('SELECT id FROM roles WHERE code = ? LIMIT 1');
            $rStmt->execute([$role]);
            $foundRoleId = $rStmt->fetchColumn();
            if (!$foundRoleId) {
                throw new ApiException('ROLE_NOT_FOUND', 'Rol no configurado.', 404);
            }
            $nextRoleId = (string) $foundRoleId;
        }
        $nextActive = $isActive !== null ? ($isActive ? 1 : 0) : (int) $target['is_active'];

        $pdo->prepare('UPDATE users SET role_id = ?, is_active = ? WHERE id = ?')->execute([$nextRoleId, $nextActive, $userId]);
        if ($roleChanged || $nextActive === 0) {
            $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$userId]);
        }

        $finalRole = $role ?? (string) $target['role_code'];
        write_audit_log($admin['id'], 'ADMIN_USER_UPDATED', 'User', $userId, ['newRole' => $finalRole, 'isActive' => (bool) $nextActive]);

        api_success([
            'customer' => [
                'id' => $userId,
                'fullName' => $target['name'],
                'email' => $target['email'],
                'role' => $finalRole,
                'roleLabel' => role_label_es($finalRole),
                'isActive' => (bool) $nextActive,
            ],
        ]);
    }

    public static function uploadsPost(): never
    {
        $admin = require_admin(true);
        $ip = extract_client_ip();
        enforce_rate_limit("admin:upload:{$admin['id']}:{$ip}", 40, 900);

        if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ApiException('MISSING_FILE', 'Adjunta un archivo de imagen válido en el campo "file".', 400);
        }
        $bytes = file_get_contents((string) $_FILES['file']['tmp_name']);
        if ($bytes === false) {
            throw new ApiException('EMPTY_FILE', 'No se pudo leer la imagen.', 400);
        }
        $saved = save_uploaded_image('catalog', $bytes, (string) ($_FILES['file']['type'] ?? ''));

        write_audit_log($admin['id'], 'ADMIN_MEDIA_UPLOADED', 'Media', $saved['filename'], [
            'mimeType' => $saved['mimeType'],
            'sizeBytes' => $saved['sizeBytes'],
            'url' => $saved['url'],
        ]);

        api_success(['url' => $saved['url'], 'mimeType' => $saved['mimeType'], 'sizeBytes' => $saved['sizeBytes']], 201);
    }

    public static function cronOffersPost(): never
    {
        $secret = trim((string) (app_config()['cron_secret'] ?? ''));
        $auth = trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
        $cronOk = $secret !== '' && strlen($secret) >= 16 && str_starts_with($auth, 'Bearer ') && hash_equals($secret, trim(substr($auth, 7)));

        $actorId = null;
        if (!$cronOk) {
            $admin = require_admin(true);
            $actorId = $admin['id'];
        }

        $pdo = db();
        $now = now_utc();
        $expired = $pdo->prepare('SELECT * FROM discounts WHERE is_active = 1 AND expires_at IS NOT NULL AND expires_at <= ?');
        $expired->execute([$now]);
        $expiredList = $expired->fetchAll();

        $active = $pdo->prepare(
            'SELECT * FROM discounts WHERE is_active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (expires_at IS NULL OR expires_at > ?)'
        );
        $active->execute([$now, $now]);
        $activeList = $active->fetchAll();

        $restored = 0;
        $activated = 0;

        foreach ($expiredList as $camp) {
            $pdo->prepare('UPDATE discounts SET is_active = 0 WHERE id = ?')->execute([$camp['id']]);
            $res = self::applyOffersScope([
                'categoryId' => $camp['category_id'],
                'brandId' => $camp['brand_id'],
                'productId' => $camp['product_id'],
                'discountPercent' => 0,
            ], $actorId ?? 'usr_admin_bsp');
            $restored += (int) $res['affectedCount'];
        }

        foreach ($activeList as $camp) {
            if ($camp['type'] !== 'PERCENTAGE' || (int) $camp['value'] <= 0 || (int) $camp['value'] > 90) {
                continue;
            }
            $w = [];
            $p = [];
            if ($camp['product_id']) {
                $w[] = 'id = ?';
                $p[] = $camp['product_id'];
            }
            if ($camp['category_id']) {
                $w[] = 'category_id = ?';
                $p[] = $camp['category_id'];
            }
            if ($camp['brand_id']) {
                $w[] = 'brand_id = ?';
                $p[] = $camp['brand_id'];
            }
            $st = $pdo->prepare('SELECT id, price, compare_at_price, is_offer FROM products' . ($w ? ' WHERE ' . implode(' AND ', $w) : ''));
            $st->execute($p);
            foreach ($st->fetchAll() as $pr) {
                $base = ($pr['compare_at_price'] && (int) $pr['compare_at_price'] > (int) $pr['price']) ? (int) $pr['compare_at_price'] : (int) $pr['price'];
                $disc = max(1, (int) round($base * (1 - (int) $camp['value'] / 100)));
                if ((int) $pr['price'] !== $disc || (int) $pr['is_offer'] !== 1) {
                    $pdo->prepare('UPDATE products SET price = ?, compare_at_price = ?, is_offer = 1 WHERE id = ?')
                        ->execute([$disc, $base, $pr['id']]);
                    $activated++;
                }
            }
        }

        api_success([
            'syncedAt' => gmdate('c'),
            'expiredCampaigns' => count($expiredList),
            'restoredProducts' => $restored,
            'activatedProducts' => $activated,
            'activeCampaignsChecked' => count($activeList),
        ]);
    }
}
