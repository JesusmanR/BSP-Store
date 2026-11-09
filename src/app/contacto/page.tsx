'use client';

import { useState } from 'react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';

const faqItems: [string, string][] = [
  [
    '¿Realizan envíos a todo Colombia?',
    'El sistema contempla envíos nacionales con tarifas configurables por departamento y ciudad, asignación de transportadora y seguimiento de número de guía.',
  ],
  [
    '¿Cómo funciona la garantía?',
    'Las condiciones dependen del fabricante, el producto y la política comercial vigente de BSP STORE. Conserva tu factura y consulta con la tienda el procedimiento de diagnóstico y garantía.',
  ],
  [
    '¿Qué métodos de pago puedo utilizar?',
    'Puedes pagar sin costo adicional por transferencia inmediata mediante nuestra Llave Bre-B (@bbbsp) desde cualquier banco o billetera en Colombia, o a través de Wompi para pagos con PSE, tarjetas de crédito/débito y otros medios habilitados.',
  ],
  [
    '¿Puedo recibir asesoría para mi setup?',
    'Sí, la experiencia está diseñada para conectarte con el equipo comercial de BSP STORE y ayudarte a elegir los periféricos ideales.',
  ],
  [
    '¿Cómo se administran los precios y el inventario?',
    'Todos los precios en COP, descuentos, variantes y existencias se gestionan directamente desde el panel administrativo protegido de BSP STORE.',
  ],
];

export default function ContactPage() {
  const [contactSent, setContactSent] = useState(false);

  return (
    <div className="container page contact-page">
      <Breadcrumb current="Contacto" />
      <div className="page-heading">
        <span className="eyebrow blue">PERSONAS DETRÁS DE LA TECNOLOGÍA</span>
        <h1>
          Hablemos de tu setup<span className="blue">.</span>
        </h1>
        <p>Te ayudamos a elegir, resolver tus dudas y dar el siguiente paso.</p>
      </div>

      <div className="contact-layout">
        <div className="contact-info">
          <h2>Estamos para ayudarte</h2>
          <p>
            Consulta sobre productos, compatibilidad, envíos o garantías. Encuentra el canal oficial
            en la tienda actual.
          </p>

          <a
            className="contact-channel"
            href="https://bspstore.com.co/inicio/"
            target="_blank"
            rel="noreferrer"
          >
            <span>
              <Icon name="chat" />
            </span>
            <div>
              <strong>WhatsApp y canales oficiales</strong>
              <small>Consultar datos en BSP STORE</small>
            </div>
            <Icon name="arrow" size={19} />
          </a>

          <div className="contact-channel">
            <span>
              <Icon name="headphones" />
            </span>
            <div>
              <strong>Horario de atención</strong>
              <small>Configurable desde el panel administrativo</small>
            </div>
          </div>

          <div className="contact-channel">
            <span>
              <Icon name="pin" />
            </span>
            <div>
              <strong>Colombia</strong>
              <small>Cobertura nacional según transportadora</small>
            </div>
          </div>

          <div className="contact-note">
            <Icon name="shield" size={26} />
            <h3>Tu tranquilidad importa</h3>
            <p>
              No publicamos teléfonos, correos ni horarios que no hayan sido verificados
              oficialmente por BSP STORE.
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
                Hemos validado tu mensaje correctamente. Puedes también comunicarte por los canales
                oficiales de BSP STORE.
              </p>
              <Button secondary onClick={() => setContactSent(false)}>
                Enviar otro mensaje
              </Button>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <Field label="Nombre completo" required />
                <Field label="Correo electrónico" required type="email" />
                <label className="field full-width">
                  ¿Sobre qué quieres hablar?{' '}
                  <select defaultValue="Asesoría de productos">
                    <option>Asesoría de productos</option>
                    <option>Envíos</option>
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
                    placeholder="Cuéntanos sobre tu setup o tu consulta..."
                  />
                </label>
              </div>
              <Button type="submit">
                Enviar mensaje
                <Icon name="arrow" size={18} />
              </Button>
            </>
          )}
        </form>
      </div>

      <section className="faq-section">
        <span className="eyebrow blue">RESPUESTAS QUE TE ACERCAN</span>
        <h2>Preguntas frecuentes</h2>
        {faqItems.map(([q, a]) => (
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
