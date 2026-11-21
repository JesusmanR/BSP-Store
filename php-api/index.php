<?php
declare(strict_types=1);

/**
 * Controlador Frontal REST API v1 (/api/v1/*) — BSP Store Colombia (PHP 8.2+ & MySQL)
 */

require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/security.php';
require_once __DIR__ . '/lib/mailer.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/CatalogController.php';
require_once __DIR__ . '/controllers/CustomerController.php';
require_once __DIR__ . '/controllers/OrderController.php';
require_once __DIR__ . '/controllers/AdminController.php';

try {
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $rawPath = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);

    // Normalizar prefijo /api/v1
    if (preg_match('#^/api/v1(/.*)?$#', $rawPath, $m)) {
        $path = $m[1] ?? '/';
    } else {
        $path = $rawPath;
    }
    $path = rtrim($path, '/') ?: '/';

    $isSensitive = str_starts_with($path, '/admin') ||
        str_starts_with($path, '/auth') ||
        str_starts_with($path, '/privacy') ||
        str_starts_with($path, '/orders');

    send_security_headers($isSensitive);
    enforce_csrf_origin_check($path);

    // 1. Health Check
    if ($path === '/health' && $method === 'GET') {
        db()->query('SELECT 1');
        api_success(['status' => 'ok', 'engine' => 'mysql', 'database' => 'up']);
    }

    // 2. Servicio seguro de imágenes gestionadas (/api/v1/media/{folder}/{filename})
    if (preg_match('#^/media/([^/]+)/([^/]+)$#', $path, $m) && $method === 'GET') {
        $file = read_managed_media_file($m[1], $m[2]);
        http_response_code(200);
        header('Content-Type: ' . $file['mimeType']);
        header('Content-Length: ' . strlen($file['bytes']));
        header('Content-Disposition: inline');
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; sandbox");
        header('Cross-Origin-Resource-Policy: same-origin');
        header('Cache-Control: public, max-age=31536000, immutable');
        echo $file['bytes'];
        exit;
    }

    // 3. Autenticación y Perfil
    if ($path === '/auth/register' && $method === 'POST') AuthController::register();
    if ($path === '/auth/login' && $method === 'POST') AuthController::login();
    if ($path === '/auth/logout' && $method === 'POST') AuthController::logout();
    if ($path === '/auth/me' && $method === 'GET') AuthController::meGet();
    if ($path === '/auth/me' && $method === 'PATCH') AuthController::mePatch();
    if ($path === '/auth/me/avatar' && $method === 'POST') AuthController::avatarUpload();
    if ($path === '/auth/me/avatar' && $method === 'DELETE') AuthController::avatarDelete();
    if ($path === '/auth/password-reset' && $method === 'POST') AuthController::passwordResetRequest();
    if ($path === '/auth/password-reset' && $method === 'PUT') AuthController::passwordResetConfirm();
    if ($path === '/auth/google' && $method === 'GET') AuthController::googleConfigGet();
    if ($path === '/auth/google/callback' && $method === 'GET') AuthController::googleCallback();

    // 4. Catálogo, Reseñas, Cupones y Envíos
    if ($path === '/products' && $method === 'GET') CatalogController::listProducts();
    if (preg_match('#^/products/([^/]+)/reviews$#', $path, $m)) {
        if ($method === 'GET') CatalogController::getReviews(urldecode($m[1]));
        if ($method === 'POST') CatalogController::postReview(urldecode($m[1]));
    }
    if (preg_match('#^/products/([^/]+)$#', $path, $m) && $method === 'GET') {
        CatalogController::getProductDetail(urldecode($m[1]));
    }
    if ($path === '/categories' && $method === 'GET') CatalogController::listCategoriesAndBrands();
    if ($path === '/coupons' && $method === 'GET') CatalogController::couponsGet();
    if ($path === '/coupons' && $method === 'POST') CatalogController::couponsPost();
    if ($path === '/coupons' && $method === 'PATCH') CatalogController::couponsPatch();
    if ($path === '/coupons/validate' && $method === 'POST') CatalogController::couponsValidate();
    if ($path === '/shipping/quote' && $method === 'POST') CatalogController::shippingQuote();

    // 5. Carrito, Favoritos, Direcciones y Privacidad (Ley 1581)
    if ($path === '/cart' && $method === 'GET') CustomerController::cartGet();
    if ($path === '/cart' && $method === 'POST') CustomerController::cartPost();
    if ($path === '/favorites' && $method === 'GET') CustomerController::favoritesGet();
    if ($path === '/favorites' && $method === 'POST') CustomerController::favoritesPost();
    if ($path === '/addresses' && $method === 'GET') CustomerController::addressesGet();
    if ($path === '/addresses' && $method === 'POST') CustomerController::addressesPost();
    if (preg_match('#^/addresses/([^/]+)$#', $path, $m)) {
        if ($method === 'PUT' || $method === 'PATCH') CustomerController::addressUpdate(urldecode($m[1]));
        if ($method === 'DELETE') CustomerController::addressDelete(urldecode($m[1]));
    }
    if ($path === '/privacy/me' && $method === 'GET') CustomerController::privacyGet();
    if ($path === '/privacy/me' && $method === 'DELETE') CustomerController::privacyDelete();

    // 6. Pedidos, Bre-B, Wompi y Contacto
    if ($path === '/orders' && $method === 'GET') OrderController::ordersGet();
    if ($path === '/orders' && $method === 'POST') OrderController::ordersPost();
    if (preg_match('#^/orders/([^/]+)$#', $path, $m)) {
        if ($method === 'GET') OrderController::orderByNumberGet(urldecode($m[1]));
        if ($method === 'POST') OrderController::orderBrebReceiptPost(urldecode($m[1]));
        if ($method === 'PATCH') OrderController::orderCancelPatch(urldecode($m[1]));
    }
    if ($path === '/webhooks/wompi' && $method === 'POST') OrderController::wompiWebhook();
    if ($path === '/contact' && $method === 'GET') OrderController::contactGet();
    if ($path === '/contact' && $method === 'POST') OrderController::contactPost();

    // 7. Panel Administrativo y Cron
    if ($path === '/admin/reports' && $method === 'GET') AdminController::reportsGet();
    if ($path === '/admin/products' && $method === 'GET') AdminController::productsGet();
    if ($path === '/admin/products' && $method === 'POST') AdminController::productsPost();
    if ($path === '/admin/products' && $method === 'PATCH') AdminController::productsPatch();
    if (preg_match('#^/admin/products/([^/]+)$#', $path, $m)) {
        if ($method === 'PATCH') AdminController::productByIdPatch(urldecode($m[1]));
        if ($method === 'DELETE') AdminController::productByIdDelete(urldecode($m[1]));
    }
    if ($path === '/admin/offers' && $method === 'GET') AdminController::offersGet();
    if ($path === '/admin/offers' && $method === 'POST') AdminController::offersPost();
    if ($path === '/admin/offers' && $method === 'DELETE') AdminController::offersDelete();
    if ($path === '/admin/inventory' && $method === 'POST') AdminController::inventoryPost();
    if ($path === '/admin/orders' && $method === 'GET') AdminController::ordersGet();
    if ($path === '/admin/orders' && $method === 'PATCH') AdminController::ordersPatch();
    if ($path === '/admin/customers' && $method === 'GET') AdminController::customersGet();
    if ($path === '/admin/customers' && $method === 'PATCH') AdminController::customersPatch();
    if ($path === '/admin/uploads' && $method === 'POST') AdminController::uploadsPost();
    if ($path === '/cron/offers' && $method === 'POST') AdminController::cronOffersPost();

    api_error('ROUTE_NOT_FOUND', 'El endpoint solicitado no existe.', 404);
} catch (ApiException $e) {
    api_error($e->errorCode, $e->getMessage(), $e->statusCode, $e->details);
} catch (Throwable $e) {
    error_log('[BSP API Fatal] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    api_error('INTERNAL_SERVER_ERROR', 'Ocurrió un error interno al procesar la solicitud.', 500);
}
