<?php
declare(strict_types=1);

/**
 * ==============================================================================
 * CONFIGURACIÓN BSP STORE COLOMBIA — HOSTINGER (SUBIDA DIRECTA POR FILEZILLA)
 * ==============================================================================
 * Por defecto usa 'driver' => 'sqlite' (funciona de inmediato sin hPanel ni phpMyAdmin).
 * Si en el futuro obtienes acceso a Hostinger hPanel / MySQL, solo cambia 'driver' => 'mysql'
 * y completa las credenciales debajo.
 */
return [
    'app_env' => 'production',
    'app_url' => 'https://bspstore.com.co',

    'db' => [
        // 'sqlite' (cero configuración, listo para subir por FileZilla) o 'mysql'
        'driver' => 'sqlite',
        'sqlite_path' => __DIR__ . '/storage/db/bsp_store.sqlite',

        // Solo se usan si cambias 'driver' => 'mysql'
        'host' => '127.0.0.1',
        'port' => '3306',
        'name' => 'uXXXXXXXXX_bsp_store',
        'user' => 'uXXXXXXXXX_bsp_user',
        'pass' => '',
        'charset' => 'utf8mb4',
    ],

    // Secreto aleatorio >= 64 caracteres (el build automático genera uno único en dist-hostinger/api/config.php)
    'auth_secret' => 'REEMPLAZAR_POR_SECRETO_ALEATORIO_64_CARACTERES_HEX_UNICO',
    'session_max_age_seconds' => 604800, // 7 días

    // Llave Bre-B oficial ($0 comisión)
    'breb' => [
        'key' => '@bbbsp',
        'recipient_name' => 'BSP Store Colombia',
    ],

    // Wompi Colombia (PSE y Tarjetas)
    'wompi' => [
        'environment' => 'sandbox',
        'public_key' => '',
        'private_key' => '',
        'integrity_secret' => '',
        'events_secret' => '',
    ],

    // Google OAuth 2.0 (Opcional)
    'google' => [
        'client_id' => '',
        'client_secret' => '',
    ],

    // Correos transaccionales (Hostinger SMTP, Resend o mail() nativo)
    'mail' => [
        'from' => 'BSP Store Colombia <compras@bspstore.com.co>',
        'admin_notify_to' => 'compras@bspstore.com.co',
        'smtp_host' => 'smtp.hostinger.com',
        'smtp_port' => 465,
        'smtp_user' => 'compras@bspstore.com.co',
        'smtp_pass' => '',
        'resend_api_key' => '',
    ],

    // Secreto para el Cron de ofertas programadas (/api/v1/cron/offers)
    'cron_secret' => '',
];
