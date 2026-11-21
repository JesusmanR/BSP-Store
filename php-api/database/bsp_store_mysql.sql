-- ==============================================================================
-- BSP STORE COLOMBIA — ESQUEMA Y DATOS INICIALES PARA MYSQL / MARIADB (HOSTINGER)
-- Compatible con MySQL 8.0+ y MariaDB 10.6+ (phpMyAdmin en Hostinger hPanel)
-- ==============================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Roles y permisos RBAC
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  code ENUM('CUSTOMER','STAFF','ADMIN') NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  permissions LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Usuarios
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  name VARCHAR(140) NOT NULL,
  phone VARCHAR(40) NULL,
  avatar_url VARCHAR(500) NULL,
  document_type VARCHAR(30) NULL,
  document_number VARCHAR(50) NULL,
  role_id VARCHAR(40) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  email_verified DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Cuentas OAuth (Google)
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  provider_account_id VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_oauth_provider_account (provider, provider_account_id),
  INDEX idx_oauth_user (user_id),
  CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Sesiones activas (token almacenado como SHA-256)
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  user_id VARCHAR(40) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tokens de recuperación de contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  user_id VARCHAR(40) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Direcciones de envío en Colombia
CREATE TABLE IF NOT EXISTS addresses (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL,
  label VARCHAR(60) NOT NULL DEFAULT 'Casa',
  recipient_name VARCHAR(140) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  department VARCHAR(80) NOT NULL,
  city VARCHAR(80) NOT NULL,
  neighborhood VARCHAR(100) NULL,
  street_address VARCHAR(200) NOT NULL,
  additional_info VARCHAR(255) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Categorías
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(300) NULL,
  icon VARCHAR(60) NULL,
  image_url VARCHAR(500) NULL,
  parent_id VARCHAR(40) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_categories_slug (slug),
  INDEX idx_categories_parent (parent_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Marcas
CREATE TABLE IF NOT EXISTS brands (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(300) NULL,
  logo_url VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_brands_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Productos del catálogo
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  legacy_id INT NULL UNIQUE,
  sku VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(191) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price INT NOT NULL,
  compare_at_price INT NULL,
  tag VARCHAR(80) NULL,
  specs LONGTEXT NOT NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_new TINYINT(1) NOT NULL DEFAULT 0,
  is_offer TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  category_id VARCHAR(40) NOT NULL,
  brand_id VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_slug (slug),
  INDEX idx_products_cat (category_id),
  INDEX idx_products_brand (brand_id),
  INDEX idx_products_price (price),
  INDEX idx_products_active_featured (is_active, is_featured),
  INDEX idx_products_active_offer (is_active, is_offer),
  INDEX idx_products_offer_updated (is_offer, updated_at),
  INDEX idx_products_active_cat_brand (is_active, category_id, brand_id),
  CONSTRAINT fk_products_cat FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Imágenes de producto
CREATE TABLE IF NOT EXISTS product_images (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  product_id VARCHAR(40) NOT NULL,
  url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_prod_images_prod (product_id),
  CONSTRAINT fk_prod_images_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Variantes de producto
CREATE TABLE IF NOT EXISTS product_variants (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  product_id VARCHAR(40) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  color_hex VARCHAR(20) NULL,
  option_value VARCHAR(100) NOT NULL,
  price_override INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_prod_variants_prod (product_id),
  CONSTRAINT fk_prod_variants_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Inventario
CREATE TABLE IF NOT EXISTS inventories (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  product_id VARCHAR(40) NOT NULL UNIQUE,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  quantity_reserved INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Movimientos de inventario (Kardex)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  inventory_id VARCHAR(40) NOT NULL,
  type ENUM('IN','OUT','ADJUSTMENT','RESERVATION','RELEASE','SALE') NOT NULL,
  quantity INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  reference_id VARCHAR(100) NULL,
  created_by_id VARCHAR(40) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inv_mov_inv (inventory_id),
  INDEX idx_inv_mov_created (created_at),
  CONSTRAINT fk_inv_mov_inv FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_mov_user FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Carritos
CREATE TABLE IF NOT EXISTS carts (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  user_id VARCHAR(40) NULL UNIQUE,
  guest_token VARCHAR(128) NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Ítems de carrito
CREATE TABLE IF NOT EXISTS cart_items (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  cart_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(40) NOT NULL,
  variant_id VARCHAR(40) NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cart_items_cart (cart_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_var FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Favoritos
CREATE TABLE IF NOT EXISTS favorites (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fav_user_prod (user_id, product_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Cupones promocionales
CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  type ENUM('PERCENTAGE','FIXED_COP') NOT NULL,
  value INT NOT NULL,
  min_order_cop INT NOT NULL DEFAULT 0,
  max_uses INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Campañas y ofertas programadas
CREATE TABLE IF NOT EXISTS discounts (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  type ENUM('PERCENTAGE','FIXED_COP') NOT NULL,
  value INT NOT NULL,
  target_scope ENUM('ALL','CATEGORY','BRAND','CATEGORY_BRAND','PRODUCT') NOT NULL DEFAULT 'ALL',
  product_id VARCHAR(40) NULL,
  category_id VARCHAR(40) NULL,
  brand_id VARCHAR(40) NULL,
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_discounts_prod (product_id),
  INDEX idx_discounts_cat (category_id),
  INDEX idx_discounts_brand (brand_id),
  INDEX idx_discounts_scope (target_scope, is_active),
  INDEX idx_discounts_schedule (is_active, starts_at, expires_at),
  CONSTRAINT fk_discounts_prod FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_discounts_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_discounts_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Zonas de envío Colombia
CREATE TABLE IF NOT EXISTS shipping_zones (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  department VARCHAR(80) NOT NULL,
  city VARCHAR(80) NULL,
  base_rate_cop INT NOT NULL,
  free_shipping_threshold_cop INT NOT NULL DEFAULT 500000,
  estimated_days_min INT NOT NULL DEFAULT 2,
  estimated_days_max INT NOT NULL DEFAULT 5,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_ship_zone_dept_city (department, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. Transportadoras
CREATE TABLE IF NOT EXISTS carriers (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(60) NOT NULL UNIQUE,
  tracking_url_template VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  order_number VARCHAR(60) NOT NULL UNIQUE,
  user_id VARCHAR(40) NULL,
  coupon_id VARCHAR(40) NULL,
  status ENUM('PENDING_PAYMENT','PENDING_BREB_VERIFICATION','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  payment_method ENUM('BREB','WOMPI_PSE','WOMPI_CARD') NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'COP',
  subtotal_cop INT NOT NULL,
  discount_cop INT NOT NULL DEFAULT 0,
  shipping_cop INT NOT NULL DEFAULT 0,
  total_cop INT NOT NULL,
  customer_name VARCHAR(140) NOT NULL,
  customer_email VARCHAR(191) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  department VARCHAR(80) NOT NULL,
  city VARCHAR(80) NOT NULL,
  street_address VARCHAR(200) NOT NULL,
  additional_info VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_created (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. Líneas de pedido
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  order_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(40) NOT NULL,
  product_name VARCHAR(180) NOT NULL,
  sku VARCHAR(80) NOT NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL,
  line_total INT NOT NULL,
  INDEX idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_prod FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. Pagos (Bre-B @bbbsp y Wompi)
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  order_id VARCHAR(40) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  method VARCHAR(40) NOT NULL,
  external_transaction_id VARCHAR(120) NULL UNIQUE,
  reference VARCHAR(80) NOT NULL,
  breb_key_used VARCHAR(60) NULL,
  transfer_receipt_ref VARCHAR(120) NULL,
  amount_cop INT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'COP',
  status ENUM('PENDING','APPROVED','DECLINED','VOIDED','ERROR','REFUNDED') NOT NULL DEFAULT 'PENDING',
  raw_payload LONGTEXT NULL,
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_ref (reference),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. Eventos de webhook (Idempotencia Wompi)
CREATE TABLE IF NOT EXISTS payment_events (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  payment_id VARCHAR(40) NULL,
  provider VARCHAR(40) NOT NULL,
  event_id VARCHAR(160) NOT NULL UNIQUE,
  event_type VARCHAR(80) NOT NULL,
  signature_valid TINYINT(1) NOT NULL DEFAULT 0,
  payload LONGTEXT NOT NULL,
  processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment_events_payment (payment_id),
  CONSTRAINT fk_payment_events_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. Despachos y guías
CREATE TABLE IF NOT EXISTS shipments (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  order_id VARCHAR(40) NOT NULL UNIQUE,
  carrier_id VARCHAR(40) NULL,
  status ENUM('PENDING','PACKED','IN_TRANSIT','DELIVERED','RETURNED') NOT NULL DEFAULT 'PENDING',
  tracking_number VARCHAR(120) NULL,
  shipped_at DATETIME NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_shipments_carrier FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. Configuración general de tienda (Bre-B, buzón contacto, opiniones)
CREATE TABLE IF NOT EXISTS store_settings (
  `key` VARCHAR(120) NOT NULL PRIMARY KEY,
  value LONGTEXT NOT NULL,
  description VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. Registro de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(40) NOT NULL PRIMARY KEY,
  actor_id VARCHAR(40) NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  ip_address VARCHAR(64) NULL,
  metadata LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. Rate limiting persistente en MySQL (compatible con Shared Hosting sin Redis)
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key VARCHAR(191) NOT NULL PRIMARY KEY,
  request_count INT NOT NULL DEFAULT 1,
  reset_at DATETIME NOT NULL,
  INDEX idx_rate_limits_reset (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- DATOS INICIALES (SEED BSP STORE COLOMBIA)
-- ==============================================================================

INSERT IGNORE INTO roles (id, code, name, description, permissions) VALUES
('role_customer', 'CUSTOMER', 'Usuario', 'Cliente comprador de BSP Store Colombia', '["catalog:read","cart:manage","orders:own","profile:own"]'),
('role_staff', 'STAFF', 'Empleado', 'Operador de inventario, pedidos y despachos', '["catalog:read","inventory:write","orders:manage","shipments:manage"]'),
('role_admin', 'ADMIN', 'Admin', 'Administrador general con control total', '["*"]');

-- Contraseñas iniciales:
-- admin@bspstore.com.co   -> BspAdmin2026*  (¡CÁMBIALA AL SUBIR A PRODUCCIÓN!)
-- cliente@bspstore.com.co -> BspCliente2026*
INSERT IGNORE INTO users (id, email, password_hash, name, phone, role_id, is_active, email_verified) VALUES
('usr_admin_bsp', 'admin@bspstore.com.co', '$2y$10$W7QN2gpaHS3Wy1uamIiA0OA0q6zHF3bdSme2PtCUhacwP2mKtPc7.', 'Administrador BSP Store', '3028000240', 'role_admin', 1, NOW()),
('usr_cliente_bsp', 'cliente@bspstore.com.co', '$2y$10$cSAjquGfFfFq2zA0U5UeIuuYoleavuUNKs/6rMkmgGJ6CjEutQk6e', 'Cliente Prueba BSP', '3028000240', 'role_customer', 1, NOW());

INSERT IGNORE INTO categories (id, name, slug, description, icon, image_url, is_active, sort_order) VALUES
('cat_mouse', 'Mouse gamer', 'mouse-gamer', 'Sensores ópticos de precisión y baja latencia LIGHTSPEED', 'mouse', '/images/g502x-plus-gallery-1-black.png', 1, 1),
('cat_teclados', 'Teclados', 'teclados', 'Teclados mecánicos, TKL y switches táctiles o lineales', 'keyboard', '/images/g915-tkl-gallery-1-carbon.png', 1, 2),
('cat_audio', 'Audífonos y audio', 'audifonos-y-audio', 'Sonido envolvente, drivers de grafeno y micrófono Blue VO!CE', 'headphones', '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png', 1, 3),
('cat_streaming', 'Streaming y micrófonos', 'streaming-y-microfonos', 'Captura vocal limpia para creadores y trabajo remoto', 'mic', '/images/g733-black-gallery-1.png', 1, 4),
('cat_accesorios', 'Accesorios', 'accesorios', 'Mousepads, receptores, soportes y complementos de escritorio', 'box', '/images/pro-x-superlight-black-gallery-1.png', 1, 5),
('cat_oficina', 'Oficina y productividad', 'oficina-y-productividad', 'Periféricos ergonómicos para largas jornadas de trabajo', 'grid', '/images/us-pro-gaming-keyboard-gallery-topdown.png', 1, 6);

INSERT IGNORE INTO brands (id, name, slug, description, logo_url, is_active, sort_order) VALUES
('brd_logitech', 'LOGITECH G', 'logitech-g', 'Periféricos inalámbricos LIGHTSPEED y sensores HERO 25K', '/images/brands/logitech-g.svg', 1, 1),
('brd_razer', 'RAZER', 'razer', 'Tecnología gaming de alto rendimiento y precisión eSports', '/images/brands/razer.svg', 1, 2),
('brd_hyperx', 'HYPERX', 'hyperx', 'Audio inmersivo, micrófonos y periféricos competitivos', '/images/brands/hyperx.svg', 1, 3),
('brd_corsair', 'CORSAIR', 'corsair', 'Teclados mecánicos, audio y ecosistema de escritorio', '/images/brands/corsair.svg', 1, 4),
('brd_asus', 'ASUS ROG', 'asus-rog', 'Republic of Gamers: ingeniería y alto rendimiento', '/images/brands/asus.svg', 1, 5),
('brd_redragon', 'REDRAGON', 'redragon', 'Periféricos mecánicos accesibles de gran durabilidad', '/images/brands/redragon.svg', 1, 6);

INSERT IGNORE INTO products (id, legacy_id, sku, name, slug, description, price, compare_at_price, tag, specs, is_featured, is_new, is_offer, is_active, category_id, brand_id) VALUES
('prd_0001', 1, 'BSP-0001', 'Mouse Logitech G502 X Plus Lightspeed', 'mouse-logitech-g502-x-plus', 'El clásico icono gaming reinventado con interruptores híbridos óptico-mecánicos LIGHTFORCE, sensor HERO 25K y tecnología inalámbrica LIGHTSPEED con iluminación RGB LIGHTSYNC de 8 zonas.', 649900, 699900, 'OFERTA', '[["Sensor","HERO 25K (hasta 25.600 DPI)"],["Conectividad","LIGHTSPEED inalámbrico / USB-C"],["Interruptores","LIGHTFORCE óptico-mecánicos"],["Autonomía","Hasta 130 h sin RGB / 37 h con RGB"]]', 1, 0, 1, 1, 'cat_mouse', 'brd_logitech'),
('prd_0002', 2, 'BSP-0002', 'Teclado Logitech G915 TKL Tenkeyless', 'teclado-logitech-g915-tkl', 'Diseño compacto sin teclado numérico en aleación de aluminio aeronáutico, switches mecánicos GL de perfil bajo y conectividad inalámbrica profesional LIGHTSPEED + Bluetooth.', 899900, NULL, 'DESTACADO', '[["Formato","Tenkeyless (TKL) ultradelgado"],["Switches","GL Mecánicos de perfil bajo"],["Conectividad","LIGHTSPEED + Bluetooth"],["Batería","Hasta 40 horas con 100% brillo"]]', 1, 0, 0, 1, 'cat_teclados', 'brd_logitech'),
('prd_0003', 3, 'BSP-0003', 'Diadema Logitech G PRO X 2 Lightspeed', 'diadema-logitech-g-pro-x-2-lightspeed', 'Diseñada junto a jugadores profesionales con transductores de grafeno de 50 mm para una respuesta acústica ultra nítida, Bluetooth, LIGHTSPEED y cable 3.5 mm.', 989900, 1099900, 'OFERTA', '[["Transductores","Grafeno PRO-G de 50 mm"],["Conectividad","LIGHTSPEED / Bluetooth / 3.5 mm"],["Micrófono","Cardioide extraíble con Blue VO!CE"],["Batería","Hasta 50 horas continuas"]]', 1, 1, 1, 1, 'cat_audio', 'brd_logitech'),
('prd_0004', 4, 'BSP-0004', 'Mouse Logitech G PRO X Superlight', 'mouse-logitech-g-pro-x-superlight', 'Menos de 63 gramos de peso sin perforaciones. Ingeniería minimalista creada para velocidad y control milimétrico en competencia eSports con pies PTFE sin aditivos.', 579900, NULL, 'DESTACADO', '[["Peso","Menos de 63 gramos"],["Sensor","HERO 25K sin suavizado"],["Conectividad","LIGHTSPEED 1 ms"],["Autonomía","Hasta 70 horas"]]', 1, 0, 0, 1, 'cat_mouse', 'brd_logitech'),
('prd_0005', 5, 'BSP-0005', 'Teclado Logitech G PRO Gaming', 'teclado-logitech-g-pro-gaming', 'Compacto y listo para torneos con switches mecánicos GX Blue Clicky, cable desmontable y memoria integrada para perfiles de iluminación LIGHTSYNC RGB.', 499900, NULL, 'NUEVO', '[["Formato","TKL compacto para torneos"],["Switches","GX Mecánicos táctiles/clicky"],["Cable","Micro-USB desmontable 1.8 m"],["Iluminación","LIGHTSYNC RGB programable"]]', 1, 1, 0, 1, 'cat_teclados', 'brd_logitech'),
('prd_0006', 6, 'BSP-0006', 'Audífonos Logitech G733 Lightspeed RGB', 'audifonos-logitech-g733-lightspeed', 'Ultraligeros de solo 278 gramos con diadema de suspensión reversible, espuma viscoelástica de doble capa, audio envolvente DTS Headphone:X 2.0 y filtros Blue VO!CE.', 549900, 629900, 'OFERTA', '[["Peso","278 gramos ultraligero"],["Conectividad","LIGHTSPEED hasta 20 m"],["Iluminación","LIGHTSYNC RGB frontal doble zona"],["Batería","Hasta 29 horas"]]', 1, 0, 1, 1, 'cat_audio', 'brd_logitech');

INSERT IGNORE INTO product_images (id, product_id, url, alt_text, sort_order, is_primary) VALUES
('img_0001', 'prd_0001', '/images/g502x-plus-gallery-1-black.png', 'Mouse Logitech G502 X Plus Lightspeed', 0, 1),
('img_0002', 'prd_0002', '/images/g915-tkl-gallery-1-carbon.png', 'Teclado Logitech G915 TKL Tenkeyless', 0, 1),
('img_0003', 'prd_0003', '/images/gallery-1-pro-x-2-lightspeed-gaming-headset-black.png', 'Diadema Logitech G PRO X 2 Lightspeed', 0, 1),
('img_0004', 'prd_0004', '/images/pro-x-superlight-black-gallery-1.png', 'Mouse Logitech G PRO X Superlight', 0, 1),
('img_0005', 'prd_0005', '/images/us-pro-gaming-keyboard-gallery-topdown.png', 'Teclado Logitech G PRO Gaming', 0, 1),
('img_0006', 'prd_0006', '/images/g733-black-gallery-1.png', 'Audífonos Logitech G733 Lightspeed RGB', 0, 1);

INSERT IGNORE INTO product_variants (id, product_id, sku, name, color_hex, option_value, is_active) VALUES
('var_0001_a', 'prd_0001', 'BSP-0001-BLK', 'Negro', '#151922', 'Negro', 1),
('var_0001_b', 'prd_0001', 'BSP-0001-WHT', 'Blanco', '#f4f6fa', 'Blanco', 1),
('var_0002_a', 'prd_0002', 'BSP-0002-CRB', 'Carbono', '#222833', 'Carbono', 1),
('var_0003_a', 'prd_0003', 'BSP-0003-BLK', 'Negro', '#151922', 'Negro', 1),
('var_0004_a', 'prd_0004', 'BSP-0004-BLK', 'Negro', '#151922', 'Negro', 1),
('var_0005_a', 'prd_0005', 'BSP-0005-BLK', 'Negro', '#151922', 'Negro', 1),
('var_0006_a', 'prd_0006', 'BSP-0006-BLK', 'Negro', '#151922', 'Negro', 1);

INSERT IGNORE INTO inventories (id, product_id, quantity_on_hand, quantity_reserved, low_stock_threshold) VALUES
('inv_0001', 'prd_0001', 18, 0, 5),
('inv_0002', 'prd_0002', 12, 0, 4),
('inv_0003', 'prd_0003', 10, 0, 3),
('inv_0004', 'prd_0004', 15, 0, 5),
('inv_0005', 'prd_0005', 20, 0, 5),
('inv_0006', 'prd_0006', 14, 0, 4);

INSERT IGNORE INTO coupons (id, code, description, type, value, min_order_cop, is_active) VALUES
('cpn_welcome10', 'BSPWELCOME10', '10% de descuento de bienvenida en tu primer pedido BSP Store', 'PERCENTAGE', 10, 200000, 1),
('cpn_setup50', 'BSPSETUP50', '$50.000 COP de descuento en compras superiores a $600.000 COP', 'FIXED_COP', 50000, 600000, 1);

INSERT IGNORE INTO shipping_zones (id, department, city, base_rate_cop, free_shipping_threshold_cop, estimated_days_min, estimated_days_max, is_active) VALUES
('zone_santander_bga', 'Santander', 'Bucaramanga', 12000, 500000, 1, 2, 1),
('zone_bogota', 'Bogotá D. C.', 'Bogotá D. C.', 16000, 500000, 2, 4, 1),
('zone_antioquia', 'Antioquia', 'Medellín', 16000, 500000, 2, 4, 1),
('zone_valle', 'Valle del Cauca', 'Cali', 18000, 500000, 2, 5, 1),
('zone_atlantico', 'Atlántico', 'Barranquilla', 19000, 500000, 3, 5, 1),
('zone_nacional', 'Nacional', NULL, 20000, 500000, 3, 6, 1);

INSERT IGNORE INTO carriers (id, name, code, tracking_url_template, is_active) VALUES
('car_local', 'Domicilio Local', 'DOMICILIO_LOCAL', NULL, 1),
('car_servi', 'Servientrega', 'SERVIENTREGA', 'https://www.servientrega.com/wps/portal/rastreo-envio', 1),
('car_coord', 'Coordinadora', 'COORDINADORA', 'https://www.coordinadora.com/portafolio-de-servicios/servicios-en-linea/rastrear-guias/', 1),
('car_inter', 'Inter Rapidísimo', 'INTERRAPIDISIMO', 'https://www.interrapidisimo.com/sigue-tu-envio/', 1),
('car_envia', 'Envía', 'ENVIA', 'https://envia.co/', 1);

INSERT IGNORE INTO store_settings (`key`, value, description) VALUES
('payments.breb', '{"enabled":true,"key":"@bbbsp","recipientName":"BSP Store Colombia","commissionCop":0}', 'Configuración oficial Llave Bre-B sin comisión'),
('store.contact', '{"city":"Bucaramanga","department":"Santander","phone":"3028000240","email":"compras@bspstore.com.co"}', 'Datos oficiales de contacto BSP Store Colombia');

SET FOREIGN_KEY_CHECKS = 1;
