'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BSP_OFFICIAL_CONTACT } from '@/data/catalog';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';

const faqItems: [string, string][] = [
  [
    '¿Dónde están ubicados y cómo funcionan los envíos locales y nacionales?',
    'Nuestra sede principal está en Bucaramanga, Santander. Realizamos entregas directas mediante Domicilio Local en Bucaramanga y su Área Metropolitana (Floridablanca, Girón y Piedecuesta), y despachos nacionales asegurados a los 32 departamentos de Colombia a través de Servientrega, Coordinadora, Inter Rapidísimo y Envía.',
  ],
  [
    '¿Cómo puedo comunicarme directamente por WhatsApp o correo?',
    `Puedes escribirnos o llamarnos directamente al celular y WhatsApp oficial ${BSP_OFFICIAL_CONTACT.phoneDisplay} o enviarnos un correo a ${BSP_OFFICIAL_CONTACT.email}.`,
  ],
  [
    '¿Qué métodos de pago puedo utilizar?',
    'Puedes pagar sin costo adicional por transferencia inmediata mediante nuestra Llave Bre-B (@bbbsp) desde cualquier banco o billetera en Colombia, o a través de Wompi para pagos con PSE, tarjetas de crédito/débito y otros medios habilitados.',
  ],
  [
    '¿Cómo rastreo el estado de mi pedido o adjunto mi comprobante Bre-B?',
    'Ingresa a la sección Mi Cuenta (incluso si compraste sin registrarte, usando la pestaña "Rastrear pedido" con tu número de orden y correo) para ver el estado en tiempo real, consultar tu guía o registrar la referencia de tu transferencia a la Llave Bre-B (@bbbsp).',
  ],
  [
    '¿Cómo funciona la garantía de los productos?',
    'Todos nuestros periféricos y equipos son 100 % originales y cuentan con garantía legal conforme a la Ley 1480 de 2011 (Estatuto del Consumidor). Conserva tu soporte de compra y escríbenos a compras@bspstore.com.co o al WhatsApp 302 800 0240 para acompañarte.',
  ],
  [
    '¿Puedo recibir asesoría personalizada para mi setup?',
    '¡Por supuesto! Nuestro equipo en Bucaramanga te asesora por WhatsApp (302 800 0240) o correo (compras@bspstore.com.co) para elegir los periféricos ideales según tu presupuesto y estilo de juego o trabajo.',
  ],
];

export default function ContactPage() {
  const [contactSent, setContactSent] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [topic, setTopic] = useState('Asesoría de productos');
  const [message, setMessage] = useState('');
  const [faqQuery, setFaqQuery] = useState('');

  const filteredFaqs = faqItems.filter(([q, a]) => {
    const qNorm = faqQuery.trim().toLowerCase();
    if (!qNorm) return true;
    return q.toLowerCase().includes(qNorm) || a.toLowerCase().includes(qNorm);
  });

  const buildWhatsAppLink = () => {
    const text = [
      'Hola BSP Store, quiero hacer una consulta:',
      senderName ? `Nombre: ${senderName}` : '',
      senderEmail ? `Correo: ${senderEmail}` : '',
      `Tema: ${topic}`,
      message ? `Mensaje: ${message}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return `${BSP_OFFICIAL_CONTACT.whatsappUrl}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="container page contact-page">
      <Breadcrumb current="Contacto" />
      <div className="page-heading">
        <span className="eyebrow blue">BUCARAMANGA, SANTANDER · PARA TODA COLOMBIA</span>
        <h1>
          Hablemos de tu setup<span className="blue">.</span>
        </h1>
        <p>
          Te asesoramos de forma directa por WhatsApp (
          <strong>{BSP_OFFICIAL_CONTACT.phoneDisplay}</strong>) o correo electrónico (
          <strong>{BSP_OFFICIAL_CONTACT.email}</strong>).
        </p>
      </div>

      <div className="contact-layout">
        <div className="contact-info">
          <h2>Canales oficiales BSP Store</h2>
          <p>
            Comunícate con nuestro equipo en <strong>Bucaramanga, Santander</strong> para consultar
            disponibilidad, compatibilidad, domicilios locales, envíos nacionales o garantías.
          </p>

          <a
            className="contact-channel"
            href={BSP_OFFICIAL_CONTACT.whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span>
              <Icon name="chat" />
            </span>
            <div>
              <strong>WhatsApp / Celular: {BSP_OFFICIAL_CONTACT.phoneDisplay}</strong>
              <small>Atención directa · +57 {BSP_OFFICIAL_CONTACT.phoneDisplay}</small>
            </div>
            <Icon name="arrow" size={19} />
          </a>

          <a className="contact-channel" href={`mailto:${BSP_OFFICIAL_CONTACT.email}`}>
            <span>
              <Icon name="mail" />
            </span>
            <div>
              <strong>Correo oficial: {BSP_OFFICIAL_CONTACT.email}</strong>
              <small>Cotizaciones, soporte de pedidos y garantías</small>
            </div>
            <Icon name="arrow" size={19} />
          </a>

          <div className="contact-channel">
            <span>
              <Icon name="pin" />
            </span>
            <div>
              <strong>Bucaramanga, Santander</strong>
              <small>
                Domicilio local en Bucaramanga (y Área Metropolitana) · Envíos a todo el país
              </small>
            </div>
          </div>

          <div className="contact-note">
            <Icon name="shield" size={26} />
            <h3>Compra y asesoría verificada</h3>
            <p>
              Nuestros únicos canales oficiales de contacto son el número{' '}
              <strong>{BSP_OFFICIAL_CONTACT.phoneDisplay}</strong>, el correo{' '}
              <strong>{BSP_OFFICIAL_CONTACT.email}</strong> y nuestra Llave Bre-B{' '}
              <strong>@bbbsp</strong>.
            </p>
          </div>
        </div>

        <form
          className="contact-form"
          onSubmit={(e) => {
            e.preventDefault();
            setContactSent(true);
          }}
        >
          <h3>Cuéntanos qué necesitas</h3>
          <p>Envíanos tu consulta sobre productos, compatibilidad o pedidos.</p>

          {contactSent ? (
            <div className="contact-success" role="status">
              <Icon name="check" size={35} />
              <h3>Mensaje recibido</h3>
              <p>
                Hemos registrado tu consulta. Si deseas atención inmediata, continúa la conversación
                en nuestro WhatsApp oficial <strong>{BSP_OFFICIAL_CONTACT.phoneDisplay}</strong>.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <a
                  href={buildWhatsAppLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                >
                  Abrir en WhatsApp ({BSP_OFFICIAL_CONTACT.phoneDisplay})
                  <Icon name="arrow" size={18} />
                </a>
                <Button secondary onClick={() => setContactSent(false)}>
                  Enviar otro mensaje
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <Field
                  label="Nombre completo"
                  required
                  value={senderName}
                  onChange={setSenderName}
                />
                <Field
                  label="Correo electrónico"
                  required
                  type="email"
                  value={senderEmail}
                  onChange={setSenderEmail}
                />
                <label className="field full-width">
                  ¿Sobre qué quieres hablar?{' '}
                  <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                    <option>Asesoría de productos</option>
                    <option>Domicilio en Bucaramanga / Envíos nacionales</option>
                    <option>Garantías y devoluciones</option>
                    <option>Otra consulta</option>
                  </select>
                </label>
                <label className="field full-width">
                  Tu mensaje <span>*</span>
                  <textarea
                    required
                    minLength={10}
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Cuéntanos sobre tu setup o tu consulta..."
                  />
                </label>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Button type="submit">
                  Enviar mensaje
                  <Icon name="arrow" size={18} />
                </Button>
                <a
                  href={buildWhatsAppLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  Escribir por WhatsApp ({BSP_OFFICIAL_CONTACT.phoneDisplay})
                </a>
              </div>
            </>
          )}
        </form>
      </div>

      <section className="faq-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <span className="eyebrow blue">RESPUESTAS QUE TE ACERCAN</span>
            <h2>Preguntas frecuentes</h2>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="search"
              aria-label="Buscar en preguntas frecuentes"
              placeholder="Buscar sobre envíos, Bre-B, garantías..."
              value={faqQuery}
              onChange={(e) => setFaqQuery(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                minWidth: '250px',
              }}
            />
            <Link href="/cuenta" className="btn btn-secondary">
              Rastrear mi pedido
            </Link>
          </div>
        </div>

        {filteredFaqs.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <Icon name="plus" size={19} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
