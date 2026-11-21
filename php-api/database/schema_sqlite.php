<?php
declare(strict_types=1);

/**
 * Inicializador automático de esquema y datos iniciales para SQLite (Zero-Config Hostinger FileZilla).
 * Crea las 28 tablas con paridad exacta respecto a bsp_store_mysql.sql y carga el catálogo inicial.
 */
function init_sqlite_database(PDO $pdo): void
{
    $pdo->exec('PRAGMA foreign_keys = ON;');
    $pdo->exec('PRAGMA journal_mode = WAL;');
    $pdo->exec('PRAGMA busy_timeout = 5000;');

    $ddl = <<<'SQL'
CREATE TABLE IF NOT EXISTS roles (
  id TEXT NOT NULL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NULL,
  permissions TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NULL,
  name TEXT NOT NULL,
  phone TEXT NULL,
  avatar_url TEXT NULL,
  document_type TEXT NULL,
  document_number TEXT NULL,
  role_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  email_verified TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_account_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT NOT NULL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  user_agent TEXT NULL,
  ip_address TEXT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT NOT NULL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Casa',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  department TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NULL,
  street_address TEXT NOT NULL,
  additional_info TEXT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  icon TEXT NULL,
  image_url TEXT NULL,
  parent_id TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  logo_url TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL PRIMARY KEY,
  legacy_id INTEGER NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price INTEGER NOT NULL,
  compare_at_price INTEGER NULL,
  tag TEXT NULL,
  specs TEXT NOT NULL DEFAULT '[]',
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_new INTEGER NOT NULL DEFAULT 0,
  is_offer INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  category_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
CREATE INDEX IF NOT EXISTS idx_products_active_offer ON products(is_active, is_offer);
CREATE INDEX IF NOT EXISTS idx_products_active_cat_brand ON products(is_active, category_id, brand_id);

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT NOT NULL PRIMARY KEY,
  product_id TEXT NOT NULL,
  url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT NOT NULL PRIMARY KEY,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color_hex TEXT NULL,
  option_value TEXT NOT NULL,
  price_override INTEGER NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventories (
  id TEXT NOT NULL PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT NOT NULL PRIMARY KEY,
  inventory_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT NULL,
  created_by_id TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NULL UNIQUE,
  guest_token TEXT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT NOT NULL PRIMARY KEY,
  cart_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT NOT NULL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  min_order_cop INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT NULL,
  expires_at TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discounts (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  target_scope TEXT NOT NULL DEFAULT 'ALL',
  product_id TEXT NULL,
  category_id TEXT NULL,
  brand_id TEXT NULL,
  starts_at TEXT NULL,
  expires_at TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shipping_zones (
  id TEXT NOT NULL PRIMARY KEY,
  department TEXT NOT NULL,
  city TEXT NULL,
  base_rate_cop INTEGER NOT NULL,
  free_shipping_threshold_cop INTEGER NOT NULL DEFAULT 500000,
  estimated_days_min INTEGER NOT NULL DEFAULT 2,
  estimated_days_max INTEGER NOT NULL DEFAULT 5,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS carriers (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  tracking_url_template TEXT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT NOT NULL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id TEXT NULL,
  coupon_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  payment_method TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  subtotal_cop INTEGER NOT NULL,
  discount_cop INTEGER NOT NULL DEFAULT 0,
  shipping_cop INTEGER NOT NULL DEFAULT 0,
  total_cop INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  department TEXT NOT NULL,
  city TEXT NOT NULL,
  street_address TEXT NOT NULL,
  additional_info TEXT NULL,
  notes TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT NOT NULL PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT NOT NULL PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  external_transaction_id TEXT NULL UNIQUE,
  reference TEXT NOT NULL,
  breb_key_used TEXT NULL,
  transfer_receipt_ref TEXT NULL,
  amount_cop INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  status TEXT NOT NULL DEFAULT 'PENDING',
  raw_payload TEXT NULL,
  verified_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT NOT NULL PRIMARY KEY,
  payment_id TEXT NULL,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  signature_valid INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT NOT NULL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  carrier_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  tracking_number TEXT NULL,
  shipped_at TEXT NULL,
  delivered_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT NOT NULL PRIMARY KEY,
  actor_id TEXT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NULL,
  ip_address TEXT NULL,
  metadata TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT NOT NULL PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  reset_at TEXT NOT NULL
);
SQL;

    $pdo->exec($ddl);

    // Seed inicial idempotente si la tabla roles está vacía
    $rolesCount = (int) $pdo->query('SELECT COUNT(*) FROM roles')->fetchColumn();
    if ($rolesCount > 0) {
        return;
    }

    $seed = <<<'SQL'
INSERT OR IGNORE INTO roles (id, code, name, description, permissions) VALUES
('role_customer', 'CUSTOMER', 'Usuario', 'Cliente comprador de BSP Store Colombia', '["catalog:read","cart:manage","orders:own","profile:own"]'),
('role_staff', 'STAFF', 'Empleado', 'Operador de inventario, pedidos y despachos', '["catalog:read","inventory:write","orders:manage","shipments:manage"]'),
('role_admin', 'ADMIN', 'Admin', 'Administrador general con control total', '["*"]');

INSERT OR IGNORE INTO users (id, email, password_hash, name, phone, role_id, is_active, email_verified) VALUES
('usr_admin_bsp', 'admin@bspstore.com.co', '$2y$10$W7QN2gpaHS3Wy1uamIiA0OA0q6zHF3bdSme2PtCUhacwP2mKtPc7.', 'Administrador BSP Store', '3028000240', 'role_admin', 1, datetime('now')),
('usr_cliente_bsp', 'cliente@bspstore.com.co', '$2y$10$cSAjquGfFfFq2zA0U5UeIuuYoleavuUNKs/6rMkmgGJ6CjEutQk6e', 'Cliente Prueba BSP', '3028000240', 'role_customer', 1, datetime('now'));

INSERT OR IGNORE INTO categories (id, name, slug, description, icon, image_url, is_active, sort_order) VALUES
('cat_mouse', 'Mouse gamer', 'mouse-gamer', 'Sensores ópticos de precisión y baja latencia LIGHTSPEED', 'mouse', '/images/g502x-plus-gallery-1-black.png', 1, 1),
('cat_teclados', 'Teclados', 'teclados', 'Teclados mecánicos, TKL y switches táctiles o lineales', 'keyboard', '/images/g915-tkl-gallery-1-carbon.png', 1, 2),
('cat_audio', 'Audífonos y audio', 'audifonos-y-audio', 'Sonido envolvente, drivers de grafeno y micrófono Blue VO!CE', 'headphones', '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png', 1, 3),
('cat_streaming', 'Streaming y micrófonos', 'streaming-y-microfonos', 'Captura vocal limpia para creadores y trabajo remoto', 'mic', '/images/g733-black-gallery-1.png', 1, 4),
('cat_accesorios', 'Accesorios', 'accesorios', 'Mousepads, receptores, soportes y complementos de escritorio', 'box', '/images/pro-x-superlight-black-gallery-1.png', 1, 5),
('cat_oficina', 'Oficina y productividad', 'oficina-y-productividad', 'Periféricos ergonómicos para largas jornadas de trabajo', 'grid', '/images/us-pro-gaming-keyboard-gallery-topdown.png', 1, 6);

INSERT OR IGNORE INTO brands (id, name, slug, description, logo_url, is_active, sort_order) VALUES
('brd_logitech', 'LOGITECH G', 'logitech-g', 'Periféricos inalámbricos LIGHTSPEED y sensores HERO 25K', '/images/brands/logitech-g.svg', 1, 1),
('brd_razer', 'RAZER', 'razer', 'Tecnología gaming de alto rendimiento y precisión eSports', '/images/brands/razer.svg', 1, 2),
('brd_hyperx', 'HYPERX', 'hyperx', 'Audio inmersivo, micrófonos y periféricos competitivos', '/images/brands/hyperx.svg', 1, 3),
('brd_corsair', 'CORSAIR', 'corsair', 'Teclados mecánicos, audio y ecosistema de escritorio', '/images/brands/corsair.svg', 1, 4),
('brd_asus', 'ASUS ROG', 'asus-rog', 'Republic of Gamers: ingeniería y alto rendimiento', '/images/brands/asus.svg', 1, 5),
('brd_redragon', 'REDRAGON', 'redragon', 'Periféricos mecánicos accesibles de gran durabilidad', '/images/brands/redragon.svg', 1, 6);

INSERT OR IGNORE INTO products (id, legacy_id, sku, name, slug, description, price, compare_at_price, tag, specs, is_featured, is_new, is_offer, is_active, category_id, brand_id) VALUES
('prd_0001', 1, 'BSP-0001', 'Mouse Logitech G502 X Plus Lightspeed', 'mouse-logitech-g502-x-plus', 'El clásico icono gaming reinventado con interruptores híbridos óptico-mecánicos LIGHTFORCE, sensor HERO 25K y tecnología inalámbrica LIGHTSPEED con iluminación RGB LIGHTSYNC de 8 zonas.', 649900, 699900, 'OFERTA', '[["Sensor","HERO 25K (hasta 25.600 DPI)"],["Conectividad","LIGHTSPEED inalámbrico / USB-C"],["Interruptores","LIGHTFORCE óptico-mecánicos"],["Autonomía","Hasta 130 h sin RGB / 37 h con RGB"]]', 1, 0, 1, 1, 'cat_mouse', 'brd_logitech'),
('prd_0002', 2, 'BSP-0002', 'Teclado Logitech G915 TKL Tenkeyless', 'teclado-logitech-g915-tkl', 'Diseño compacto sin teclado numérico en aleación de aluminio aeronáutico, switches mecánicos GL de perfil bajo y conectividad inalámbrica profesional LIGHTSPEED + Bluetooth.', 899900, NULL, 'DESTACADO', '[["Formato","Tenkeyless (TKL) ultradelgado"],["Switches","GL Mecánicos de perfil bajo"],["Conectividad","LIGHTSPEED + Bluetooth"],["Batería","Hasta 40 horas con 100% brillo"]]', 1, 0, 0, 1, 'cat_teclados', 'brd_logitech'),
('prd_0003', 3, 'BSP-0003', 'Diadema Logitech G PRO X 2 Lightspeed', 'diadema-logitech-g-pro-x-2-lightspeed', 'Diseñada junto a jugadores profesionales con transductores de grafeno de 50 mm para una respuesta acústica ultra nítida, Bluetooth, LIGHTSPEED y cable 3.5 mm.', 989900, 1099900, 'OFERTA', '[["Transductores","Grafeno PRO-G de 50 mm"],["Conectividad","LIGHTSPEED / Bluetooth / 3.5 mm"],["Micrófono","Cardioide extraíble con Blue VO!CE"],["Batería","Hasta 50 horas continuas"]]', 1, 1, 1, 1, 'cat_audio', 'brd_logitech'),
('prd_0004', 4, 'BSP-0004', 'Mouse Logitech G PRO X Superlight', 'mouse-logitech-g-pro-x-superlight', 'Menos de 63 gramos de peso sin perforaciones. Ingeniería minimalista creada para velocidad y control milimétrico en competencia eSports con pies PTFE sin aditivos.', 579900, NULL, 'DESTACADO', '[["Peso","Menos de 63 gramos"],["Sensor","HERO 25K sin suavizado"],["Conectividad","LIGHTSPEED 1 ms"],["Autonomía","Hasta 70 horas"]]', 1, 0, 0, 1, 'cat_mouse', 'brd_logitech'),
('prd_0005', 5, 'BSP-0005', 'Teclado Logitech G PRO Gaming', 'teclado-logitech-g-pro-gaming', 'Compacto y listo para torneos con switches mecánicos GX Blue Clicky, cable desmontable y memoria integrada para perfiles de iluminación LIGHTSYNC RGB.', 499900, NULL, 'NUEVO', '[["Formato","TKL compacto para torneos"],["Switches","GX Mecánicos táctiles/clicky"],["Cable","Micro-USB desmontable 1.8 m"],["Iluminación","LIGHTSYNC RGB programable"]]', 1, 1, 0, 1, 'cat_teclados', 'brd_logitech'),
('prd_0006', 6, 'BSP-0006', 'Audífonos Logitech G733 Lightspeed RGB', 'audifonos-logitech-g733-lightspeed', 'Ultraligeros de solo 278 gramos con diadema de suspensión reversible, espuma viscoelástica de doble capa, audio envolvente DTS Headphone:X 2.0 y filtros Blue VO!CE.', 549900, 629900, 'OFERTA', '[["Peso","278 gramos ultraligero"],["Conectividad","LIGHTSPEED hasta 20 m"],["Iluminación","LIGHTSYNC RGB frontal doble zona"],["Batería","Hasta 29 horas"]]', 1, 0, 1, 1, 'cat_audio', 'brd_logitech');

INSERT OR IGNORE INTO product_images (id, product_id, url, alt_text, sort_order, is_primary) VALUES
('img_0001', 'prd_0001', '/images/g502x-plus-gallery-1-black.png', 'Mouse Logitech G502 X Plus Lightspeed', 0, 1),
('img_0002', 'prd_0002', '/images/g915-tkl-gallery-1-carbon.png', 'Teclado Logitech G915 TKL Tenkeyless', 0, 1),
('img_0003', 'prd_0003', '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png', 'Diadema Logitech G PRO X 2 Lightspeed', 0, 1),
('img_0004', 'prd_0004', '/images/pro-x-superlight-black-gallery-1.png', 'Mouse Logitech G PRO X Superlight', 0, 1),
('img_0005', 'prd_0005', '/images/us-pro-gaming-keyboard-gallery-topdown.png', 'Teclado Logitech G PRO Gaming', 0, 1),
('img_0006', 'prd_0006', '/images/g733-black-gallery-1.png', 'Audífonos Logitech G733 Lightspeed RGB', 0, 1);

INSERT OR IGNORE INTO product_variants (id, product_id, sku, name, color_hex, option_value, is_active) VALUES
('var_0001_a', 'prd_0001', 'BSP-0001-BLK', 'Negro', '#151922', 'Negro', 1),
('var_0001_b', 'prd_0001', 'BSP-0001-WHT', 'Blanco', '#f4f6fa', 'Blanco', 1),
('var_0002_a', 'prd_0002', 'BSP-0002-CRB', 'Carbono', '#222833', 'Carbono', 1),
('var_0003_a', 'prd_0003', 'BSP-0003-BLK', 'Negro', '#151922', 'Negro', 1),
('var_0004_a', 'prd_0004', 'BSP-0004-BLK', 'Negro', '#151922', 'Negro', 1),
('var_0005_a', 'prd_0005', 'BSP-0005-BLK', 'Negro', '#151922', 'Negro', 1),
('var_0006_a', 'prd_0006', 'BSP-0006-BLK', 'Negro', '#151922', 'Negro', 1);

INSERT OR IGNORE INTO inventories (id, product_id, quantity_on_hand, quantity_reserved, low_stock_threshold) VALUES
('inv_0001', 'prd_0001', 18, 0, 5),
('inv_0002', 'prd_0002', 12, 0, 4),
('inv_0003', 'prd_0003', 10, 0, 3),
('inv_0004', 'prd_0004', 15, 0, 5),
('inv_0005', 'prd_0005', 20, 0, 5),
('inv_0006', 'prd_0006', 14, 0, 4);

INSERT OR IGNORE INTO coupons (id, code, description, type, value, min_order_cop, is_active) VALUES
('cpn_welcome10', 'BSPWELCOME10', '10% de descuento de bienvenida en tu primer pedido BSP Store', 'PERCENTAGE', 10, 200000, 1),
('cpn_setup50', 'BSPSETUP50', '$50.000 COP de descuento en compras superiores a $600.000 COP', 'FIXED_COP', 50000, 600000, 1);

INSERT OR IGNORE INTO shipping_zones (id, department, city, base_rate_cop, free_shipping_threshold_cop, estimated_days_min, estimated_days_max, is_active) VALUES
('zone_santander_bga', 'Santander', 'Bucaramanga', 12000, 500000, 1, 2, 1),
('zone_bogota', 'Bogotá D. C.', 'Bogotá D. C.', 16000, 500000, 2, 4, 1),
('zone_antioquia', 'Antioquia', 'Medellín', 16000, 500000, 2, 4, 1),
('zone_valle', 'Valle del Cauca', 'Cali', 18000, 500000, 2, 5, 1),
('zone_atlantico', 'Atlántico', 'Barranquilla', 19000, 500000, 3, 5, 1),
('zone_nacional', 'Nacional', NULL, 20000, 500000, 3, 6, 1);

INSERT OR IGNORE INTO carriers (id, name, code, tracking_url_template, is_active) VALUES
('car_local', 'Domicilio Local', 'DOMICILIO_LOCAL', NULL, 1),
('car_servi', 'Servientrega', 'SERVIENTREGA', 'https://www.servientrega.com/wps/portal/rastreo-envio', 1),
('car_coord', 'Coordinadora', 'COORDINADORA', 'https://www.coordinadora.com/portafolio-de-servicios/servicios-en-linea/rastrear-guias/', 1),
('car_inter', 'Inter Rapidísimo', 'INTERRAPIDISIMO', 'https://www.interrapidisimo.com/sigue-tu-envio/', 1),
('car_envia', 'Envía', 'ENVIA', 'https://envia.co/', 1);

INSERT OR IGNORE INTO store_settings (key, value, description) VALUES
('payments.breb', '{"enabled":true,"key":"@bbbsp","recipientName":"BSP Store Colombia","commissionCop":0}', 'Configuración oficial Llave Bre-B sin comisión'),
('store.contact', '{"city":"Bucaramanga","department":"Santander","phone":"3028000240","email":"compras@bspstore.com.co"}', 'Datos oficiales de contacto BSP Store Colombia');
SQL;

    $pdo->exec($seed);
}
