<?php
declare(strict_types=1);

/**
 * Núcleo compartido del backend PHP 8 + MySQL de BSP Store Colombia.
 */

class ApiException extends RuntimeException
{
    public string $errorCode;
    public int $statusCode;
    public mixed $details;

    public function __construct(string $errorCode, string $message, int $statusCode = 400, mixed $details = null)
    {
        parent::__construct($message);
        $this->errorCode = $errorCode;
        $this->statusCode = $statusCode;
        $this->details = $details;
    }
}

function app_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }

    $configPath = __DIR__ . '/../config.php';
    if (!is_file($configPath)) {
        $configPath = __DIR__ . '/../config.example.php';
    }

    $loaded = require $configPath;
    if (!is_array($loaded)) {
        throw new ApiException('CONFIG_ERROR', 'Archivo de configuración inválido.', 500);
    }
    $cfg = $loaded;
    return $cfg;
}

function db_driver(): string
{
    return strtolower((string) (app_config()['db']['driver'] ?? 'sqlite'));
}

function sql_for_update(): string
{
    return db_driver() === 'mysql' ? ' FOR UPDATE' : '';
}

function db(?PDO $overridePdo = null): PDO
{
    static $pdo = null;
    if ($overridePdo !== null) {
        $pdo = $overridePdo;
        return $pdo;
    }
    if ($pdo !== null) {
        return $pdo;
    }

    $db = app_config()['db'] ?? [];
    $driver = db_driver();

    try {
        if ($driver === 'sqlite') {
            $sqlitePath = (string) ($db['sqlite_path'] ?? (dirname(__DIR__) . '/storage/db/bsp_store.sqlite'));
            $dir = dirname($sqlitePath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $pdo = new PDO('sqlite:' . $sqlitePath, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            require_once dirname(__DIR__) . '/database/schema_sqlite.php';
            init_sqlite_database($pdo);
            return $pdo;
        }

        $host = (string) ($db['host'] ?? '127.0.0.1');
        $port = (string) ($db['port'] ?? '3306');
        $name = (string) ($db['name'] ?? '');
        $user = (string) ($db['user'] ?? '');
        $pass = (string) ($db['pass'] ?? '');
        $charset = (string) ($db['charset'] ?? 'utf8mb4');

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $e) {
        error_log('[BSP DB Connection Error] ' . $e->getMessage());
        throw new ApiException('DATABASE_UNAVAILABLE', 'No fue posible conectar con la base de datos.', 503);
    }

    return $pdo;
}

function db_get_setting(string $key): ?string
{
    $col = db_driver() === 'mysql' ? '`key`' : 'key';
    $stmt = db()->prepare("SELECT value FROM store_settings WHERE {$col} = ? LIMIT 1");
    $stmt->execute([$key]);
    $val = $stmt->fetchColumn();
    return is_string($val) ? $val : null;
}

function db_upsert_setting(string $key, string $value, string $description): void
{
    $pdo = db();
    $col = db_driver() === 'mysql' ? '`key`' : 'key';
    $now = now_utc();
    $upd = $pdo->prepare("UPDATE store_settings SET value = ?, description = ?, updated_at = ? WHERE {$col} = ?");
    $upd->execute([$value, $description, $now, $key]);
    if ($upd->rowCount() === 0) {
        $chk = $pdo->prepare("SELECT 1 FROM store_settings WHERE {$col} = ? LIMIT 1");
        $chk->execute([$key]);
        if (!$chk->fetchColumn()) {
            $ins = $pdo->prepare("INSERT INTO store_settings ({$col}, value, description, updated_at) VALUES (?, ?, ?, ?)");
            $ins->execute([$key, $value, $description, $now]);
        }
    }
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function api_success(mixed $data, int $status = 200): never
{
    json_response(['ok' => true, 'data' => $data], $status);
}

function api_error(string $code, string $message, int $status = 400, mixed $details = null): never
{
    $err = ['code' => $code, 'message' => $message];
    if ($details !== null) {
        $err['details'] = $details;
    }
    json_response(['ok' => false, 'error' => $err], $status);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    if (strlen($raw) > 2 * 1024 * 1024) {
        throw new ApiException('PAYLOAD_TOO_LARGE', 'La solicitud supera el límite máximo permitido.', 413);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new ApiException('INVALID_JSON', 'El cuerpo de la solicitud no es un JSON válido.', 400);
    }
    return $decoded;
}

function generate_id(string $prefix = 'bsp'): string
{
    return $prefix . '_' . bin2hex(random_bytes(10));
}

function generate_uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function strip_spanish_accents(string $value): string
{
    return strtr($value, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N',
    ]);
}

function to_slug(string $value): string
{
    $base = strip_spanish_accents($value);
    $slug = strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $base));
    $slug = trim($slug, '-');
    return $slug !== '' ? $slug : 'item-' . bin2hex(random_bytes(3));
}

function role_label_es(string $code): string
{
    return match (strtoupper($code)) {
        'ADMIN' => 'Admin',
        'STAFF' => 'Empleado',
        default => 'Usuario',
    };
}

function assert_no_html(string $val, string $fieldLabel = 'Campo'): string
{
    $clean = trim($val);
    if (preg_match('/[<>]/', $clean)) {
        throw new ApiException('VALIDATION_ERROR', "{$fieldLabel} no puede contener etiquetas HTML.", 422);
    }
    return $clean;
}

function is_local_delivery_destination(string $department, string $city): bool
{
    $normalize = static function (string $s): string {
        $clean = strip_spanish_accents(trim($s));
        return strtolower(preg_replace('/\s+/', ' ', $clean) ?? '');
    };
    $dept = $normalize($department);
    $cty = $normalize($city);
    if ($dept !== 'santander') {
        return false;
    }
    return in_array($cty, ['bucaramanga', 'floridablanca', 'giron', 'piedecuesta'], true);
}

function calculate_shipping_quote(string $department, string $city, int $subtotalCop): array
{
    $isLocal = is_local_delivery_destination($department, $city);
    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM shipping_zones WHERE is_active = 1 AND LOWER(department) = LOWER(?) LIMIT 1');
    $stmt->execute([trim($department)]);
    $zone = $stmt->fetch();

    if (!$zone) {
        $zone = $pdo->query("SELECT * FROM shipping_zones WHERE department = 'Nacional' LIMIT 1")->fetch();
    }

    $baseRate = $isLocal ? 12000 : (int) ($zone['base_rate_cop'] ?? 20000);
    $threshold = (int) ($zone['free_shipping_threshold_cop'] ?? 500000);
    $freeApplied = $subtotalCop >= $threshold;
    $shippingCop = $freeApplied ? 0 : $baseRate;

    return [
        'department' => $department,
        'city' => $city,
        'isLocalDelivery' => $isLocal,
        'deliveryMethodName' => $isLocal ? 'Domicilio Local' : 'Envío Nacional Asegurado',
        'shippingCop' => $shippingCop,
        'baseRateCop' => $baseRate,
        'freeShippingThresholdCop' => $threshold,
        'freeShippingApplied' => $freeApplied,
        'estimatedDaysMin' => $isLocal ? 1 : (int) ($zone['estimated_days_min'] ?? 2),
        'estimatedDaysMax' => $isLocal ? 2 : (int) ($zone['estimated_days_max'] ?? 5),
        'availableCarriers' => $isLocal
            ? ['Domicilio Local']
            : ['Servientrega', 'Coordinadora', 'Inter Rapidísimo', 'Envía'],
    ];
}

function now_utc(): string
{
    return gmdate('Y-m-d H:i:s');
}

function iso_date(?string $mysqlDatetime): ?string
{
    if (!$mysqlDatetime) {
        return null;
    }
    $ts = strtotime($mysqlDatetime . ' UTC');
    return $ts !== false ? gmdate('c', $ts) : $mysqlDatetime;
}
