<?php
declare(strict_types=1);

/**
 * ==============================================================================
 * CONFIGURACIÓN BSP STORE COLOMBIA — HOSTINGER (PHP 8.2+ & MYSQL)
 * ==============================================================================
 * INSTRUCCIONES:
 * 1. Renombra o copia este archivo como `config.php` en la carpeta `public_html/api/`.
 * 2. Completa las credenciales de tu base de datos MySQL creada en Hostinger hPanel.
 * 3. NUNCA subas `config.php` con contraseñas reales a GitHub.
 */
return [
    'app_env' => 'production', // 'production' o 'development'
    'app_url' => 'https://bspstore.com.co',

    // Base de datos MySQL creada en Hostinger hPanel -> Bases de datos
    'db' => [
        'host' => '127.0.0.1',
        'port' => '3306',
        'name' => 'uXXXXXXXXX_bsp_store',
        'user' => 'uXXXXXXXXX_bsp_user',
        'pass' => 'REEMPLAZAR_CON_CLAVE_MYSQL_HOSTINGER',
        'charset' => 'utf8mb4',
    ],

    // Secreto aleatorio >= 64 caracteres (genera uno único para producción)
    'auth_secret' => 'REEMPLAZAR_POR_SECRETO_ALEATORIO_64_CARACTERES_HEX_UNICO',
    'session_max_age_seconds' => 604800, // 7 días

    // Llave Bre-B oficial ($0 comisión)
    'breb' => [
        'key' => '@bbbsp',
        'recipient_name' => 'BSP Store Colombia',
    ],

    // Wompi Colombia (PSE y Tarjetas)
    'wompi' => [
        'environment' => 'sandbox', // Cambiar a 'production' con llaves reales
        'public_key' => '',
        'private_key' => '',
        'integrity_secret' => '',
        'events_secret' => '',
    ],

    // Google OAuth 2.0 (Opcional: llena ambos si deseas activar "Continuar con Google")
    'google' => [
        'client_id' => '',
        'client_secret' => '',
    ],

    // Correos transaccionales (Hostinger SMTP o Resend)
    'mail' => [
        'from' => 'BSP Store Colombia <compras@bspstore.com.co>',
        'admin_notify_to' => 'compras@bspstore.com.co',
        // Opción A: SMTP nativo de Hostinger
        'smtp_host' => 'smtp.hostinger.com',
        'smtp_port' => 465,
        'smtp_user' => 'compras@bspstore.com.co',
        'smtp_pass' => '',
        // Opción B: Resend API (opcional, tiene prioridad si está presente)
        'resend_api_key' => '',
    ],

    // Secreto para proteger el Cron de ofertas programadas (/api/v1/cron/offers)
    'cron_secret' => '',
];
