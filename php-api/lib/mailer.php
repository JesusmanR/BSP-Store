<?php
declare(strict_types=1);

/**
 * Servicio de correos transaccionales en PHP puro para Hostinger:
 * Soporta Resend API (cURL), SMTP SSL nativo de Hostinger (smtp.hostinger.com:465)
 * y fallback seguro a mail() de PHP sin dependencias Composer.
 */

function email_escape(string $val): string
{
    return htmlspecialchars($val, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function email_format_cop(int $amount): string
{
    return '$' . number_format($amount, 0, ',', '.') . ' COP';
}

function wrap_bsp_email_html(string $title, string $preheader, string $bodyHtml): string
{
    $safeTitle = email_escape($title);
    $safePre = email_escape($preheader);
    return <<<HTML
<!DOCTYPE html>
<html lang="es-CO">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{$safeTitle}</title></head>
<body style="margin:0;padding:0;background:#0a0f18;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e6edf7;">
  <div style="display:none;max-height:0;overflow:hidden;">{$safePre}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0f18;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#111927;border:1px solid #223047;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#0d1524 0%,#142642 100%);border-bottom:1px solid #223047;">
          <div style="font-size:20px;font-weight:800;letter-spacing:0.04em;color:#ffffff;">BSP <span style="color:#168bff;">STORE</span></div>
          <div style="font-size:11px;color:#8ba3c4;margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">Tecnología y Periféricos · Colombia</div>
        </td></tr>
        <tr><td style="padding:28px;">{$bodyHtml}</td></tr>
        <tr><td style="padding:18px 28px;background:#0c121e;border-top:1px solid #1e2a3d;font-size:11px;color:#7f93b0;line-height:1.6;">
          <strong style="color:#c7d6ec;">BSP Store Colombia</strong> · Bucaramanga, Santander<br>
          WhatsApp: 302 800 0240 · compras@bspstore.com.co<br>
          Tratamiento de datos conforme a la Ley 1581 de 2012 (Habeas Data Colombia).
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
}

function send_smtp_ssl_mail(array $mailCfg, string $to, string $subject, string $html, ?string $replyTo = null): bool
{
    $host = trim((string) ($mailCfg['smtp_host'] ?? ''));
    $port = (int) ($mailCfg['smtp_port'] ?? 465);
    $user = trim((string) ($mailCfg['smtp_user'] ?? ''));
    $pass = (string) ($mailCfg['smtp_pass'] ?? '');
    $fromHeader = trim((string) ($mailCfg['from'] ?? $user));
    $fromEmail = preg_match('/<([^>]+)>/', $fromHeader, $m) ? $m[1] : $user;

    if ($host === '' || $user === '' || $pass === '') {
        return false;
    }

    $prefix = $port === 465 ? 'ssl://' : '';
    $fp = @fsockopen($prefix . $host, $port, $errno, $errstr, 10);
    if (!$fp) {
        error_log("[BSP SMTP Connect Error] {$errno} {$errstr}");
        return false;
    }

    $read = static function () use ($fp): string {
        $data = '';
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (strlen($line) >= 4 && $line[3] === ' ') {
                break;
            }
        }
        return $data;
    };
    $cmd = static function (string $c) use ($fp, $read): string {
        fwrite($fp, $c . "\r\n");
        return $read();
    };

    try {
        $read();
        $cmd('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'bspstore.com.co'));
        if ($port === 587) {
            $cmd('STARTTLS');
            stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $cmd('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'bspstore.com.co'));
        }
        $cmd('AUTH LOGIN');
        $cmd(base64_encode($user));
        $authResp = $cmd(base64_encode($pass));
        if (!str_starts_with($authResp, '235')) {
            fclose($fp);
            return false;
        }
        $cmd("MAIL FROM:<{$fromEmail}>");
        $cmd("RCPT TO:<{$to}>");
        $cmd('DATA');

        $encodedSubj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $headers = [
            "From: {$fromHeader}",
            "To: <{$to}>",
            "Subject: {$encodedSubj}",
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ];
        if ($replyTo) {
            $headers[] = "Reply-To: {$replyTo}";
        }
        $body = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($html)) . "\r\n.";
        $sendResp = $cmd($body);
        $cmd('QUIT');
        fclose($fp);
        return str_starts_with($sendResp, '250');
    } catch (Throwable $e) {
        @fclose($fp);
        error_log('[BSP SMTP Send Error] ' . $e->getMessage());
        return false;
    }
}

function send_transactional_email(string $to, string $subject, string $html, string $text, ?string $replyTo = null): bool
{
    $cfg = app_config();
    $mailCfg = $cfg['mail'] ?? [];
    $resendKey = trim((string) ($mailCfg['resend_api_key'] ?? ''));

    // 1. Resend API si está configurado
    if ($resendKey !== '' && function_exists('curl_init')) {
        $payload = [
            'from' => (string) ($mailCfg['from'] ?? 'BSP Store <compras@bspstore.com.co>'),
            'to' => [$to],
            'subject' => $subject,
            'html' => $html,
            'text' => $text,
        ];
        if ($replyTo) {
            $payload['reply_to'] = $replyTo;
        }
        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $resendKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
        ]);
        $res = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($res !== false && $status >= 200 && $status < 300) {
            return true;
        }
    }

    // 2. SMTP SSL de Hostinger (smtp.hostinger.com:465)
    if (!empty($mailCfg['smtp_pass'])) {
        if (send_smtp_ssl_mail($mailCfg, $to, $subject, $html, $replyTo)) {
            return true;
        }
    }

    // 3. Fallback nativo mail() de Hostinger en producción
    if (($cfg['app_env'] ?? 'production') === 'production') {
        $from = (string) ($mailCfg['from'] ?? 'compras@bspstore.com.co');
        $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: {$from}\r\n";
        if ($replyTo) {
            $headers .= "Reply-To: {$replyTo}\r\n";
        }
        return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $html, $headers);
    }

    return false;
}

function send_password_reset_email(string $to, string $resetToken): void
{
    $appUrl = rtrim((string) (app_config()['app_url'] ?? 'https://bspstore.com.co'), '/');
    $link = $appUrl . '/cuenta/?tab=forgot&token=' . urlencode($resetToken);
    $safeLink = email_escape($link);
    $body = <<<HTML
<h1 style="margin:0 0 12px;font-size:20px;color:#ffffff;">Restablece tu contraseña</h1>
<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#c7d6ec;">
  Recibimos una solicitud para cambiar la contraseña de tu cuenta en <strong>BSP Store</strong>.
  Este enlace es válido por <strong>30 minutos</strong> y solo puede usarse una vez.
</p>
<p style="margin:0 0 22px;">
  <a href="{$safeLink}" style="display:inline-block;padding:12px 22px;background:#168bff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Crear nueva contraseña</a>
</p>
<p style="margin:0;font-size:12px;color:#8ba3c4;">Si no solicitaste este cambio, ignora este mensaje.</p>
HTML;
    send_transactional_email(
        $to,
        'Restablece tu contraseña — BSP Store Colombia',
        wrap_bsp_email_html('Restablece tu contraseña', 'Enlace válido por 30 minutos', $body),
        "Restablece tu contraseña en BSP Store: {$link}"
    );
}

function send_order_confirmation_email(array $order, array $items): void
{
    $appUrl = rtrim((string) (app_config()['app_url'] ?? 'https://bspstore.com.co'), '/');
    $track = email_escape($appUrl . '/seguimiento/');
    $name = email_escape((string) $order['customer_name']);
    $num = email_escape((string) $order['order_number']);
    $dest = email_escape((string) $order['city'] . ', ' . (string) $order['department']);
    $total = email_format_cop((int) $order['total_cop']);
    $rowsHtml = '';
    foreach ($items as $it) {
        $pName = email_escape((string) $it['product_name']);
        $qty = (int) $it['quantity'];
        $line = email_format_cop((int) $it['line_total']);
        $rowsHtml .= "<tr><td style='padding:8px 0;border-bottom:1px solid #1f2c40;font-size:13px;color:#e6edf7;'>{$pName} × {$qty}</td><td align='right' style='padding:8px 0;border-bottom:1px solid #1f2c40;font-size:13px;font-weight:600;color:#ffffff;'>{$line}</td></tr>";
    }
    $brebKey = email_escape((string) (app_config()['breb']['key'] ?? '@bbbsp'));
    $payNote = $order['payment_method'] === 'BREB'
        ? "<div style='margin:16px 0;padding:14px;background:#0e223d;border:1px solid #1d4e89;border-radius:10px;font-size:13px;color:#cfe4ff;'><strong>Transferencia Bre-B ($0 comisión):</strong> Llave <strong style='color:#55b7ff;'>{$brebKey}</strong>. Reporta el comprobante desde tu cuenta o WhatsApp 302 800 0240.</div>"
        : "<div style='margin:16px 0;padding:14px;background:#0e223d;border:1px solid #1d4e89;border-radius:10px;font-size:13px;color:#cfe4ff;'><strong>Wompi Colombia:</strong> Confirmaremos tu pedido automáticamente al aprobarse el pago.</div>";
    $body = "<h1 style='margin:0 0 10px;font-size:20px;color:#ffffff;'>¡Gracias por tu compra, {$name}!</h1><p style='font-size:14px;color:#c7d6ec;'>Pedido <strong style='color:#55b7ff;'>{$num}</strong> · Destino: <strong>{$dest}</strong></p><table width='100%' cellspacing='0' cellpadding='0'>{$rowsHtml}<tr><td style='padding:10px 0;font-weight:700;color:#fff;'>Total</td><td align='right' style='padding:10px 0;font-weight:800;color:#55b7ff;'>{$total}</td></tr></table>{$payNote}<p style='margin-top:18px;'><a href='{$track}' style='display:inline-block;padding:11px 20px;background:#168bff;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;'>Seguir mi pedido</a></p>";

    send_transactional_email(
        (string) $order['customer_email'],
        "Confirmación de pedido {$order['order_number']} — BSP Store",
        wrap_bsp_email_html("Pedido {$order['order_number']}", "Total {$total}", $body),
        "Gracias por tu compra en BSP Store. Pedido {$order['order_number']}. Total {$total}."
    );
}

function send_shipment_dispatched_email(array $order, string $carrierName, string $trackingNumber): void
{
    $appUrl = rtrim((string) (app_config()['app_url'] ?? 'https://bspstore.com.co'), '/');
    $track = email_escape($appUrl . '/seguimiento/');
    $name = email_escape((string) $order['customer_name']);
    $num = email_escape((string) $order['order_number']);
    $carrier = email_escape($carrierName);
    $guide = email_escape($trackingNumber);
    $body = "<h1 style='margin:0 0 10px;font-size:20px;color:#ffffff;'>¡Tu pedido ya está en camino!</h1><p style='font-size:14px;color:#c7d6ec;'>Hola {$name}, despachamos tu pedido <strong style='color:#55b7ff;'>{$num}</strong>.</p><div style='padding:14px;background:#0e223d;border:1px solid #1d4e89;border-radius:10px;font-size:13px;color:#e6edf7;'><strong>Empresa:</strong> {$carrier}<br><strong>Guía:</strong> <span style='color:#4ade80;font-weight:700;'>{$guide}</span></div><p style='margin-top:18px;'><a href='{$track}' style='display:inline-block;padding:11px 20px;background:#168bff;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:13px;'>Seguir mi pedido</a></p>";

    send_transactional_email(
        (string) $order['customer_email'],
        "Pedido {$order['order_number']} despachado · Guía {$trackingNumber}",
        wrap_bsp_email_html("Pedido despachado", "Guía {$trackingNumber}", $body),
        "Tu pedido {$order['order_number']} fue despachado con {$carrierName}. Guía: {$trackingNumber}."
    );
}

function send_contact_inquiry_notification_email(string $name, string $email, string $topic, string $message): void
{
    $adminTo = (string) (app_config()['mail']['admin_notify_to'] ?? 'compras@bspstore.com.co');
    $sName = email_escape($name);
    $sEmail = email_escape($email);
    $sTopic = email_escape($topic);
    $sMsg = nl2br(email_escape($message));
    $body = "<h1 style='margin:0 0 10px;font-size:18px;color:#fff;'>Nueva consulta desde /contacto</h1><p style='font-size:13px;color:#c7d6ec;'><strong>Nombre:</strong> {$sName}<br><strong>Correo:</strong> {$sEmail}<br><strong>Asunto:</strong> {$sTopic}</p><div style='padding:14px;background:#0c1422;border:1px solid #223047;border-radius:8px;font-size:13px;color:#e6edf7;'>{$sMsg}</div>";

    send_transactional_email(
        $adminTo,
        "[Contacto BSP Store] {$topic} — {$name}",
        wrap_bsp_email_html('Nueva consulta BSP Store', $topic, $body),
        "Consulta de {$name} ({$email}) - {$topic}:\n{$message}",
        $email
    );
}
