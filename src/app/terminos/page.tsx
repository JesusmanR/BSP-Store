import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'Términos y Condiciones Comerciales | BSP Store Colombia',
  description:
    'Términos y condiciones de uso y compraventa en línea de BSP Store Colombia conforme al Estatuto del Consumidor (Ley 1480 de 2011) y la Ley 527 de 1999.',
};

export default function TerminosPage() {
  return (
    <div className="container page">
      <Breadcrumb current="Términos y condiciones" />

      <div className="page-heading">
        <span className="eyebrow blue">MARCO LEGAL DE COMERCIO ELECTRÓNICO EN COLOMBIA</span>
        <h1>
          Términos y Condiciones Comerciales<span className="blue">.</span>
        </h1>
        <p>
          Versión vigente: <strong>v2026.1-CO</strong> · Regulado por el Estatuto del Consumidor (
          <strong>Ley 1480 de 2011</strong>) y la Ley de Comercio Electrónico (
          <strong>Ley 527 de 1999</strong>).
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '22px',
          maxWidth: '920px',
          lineHeight: 1.7,
        }}
      >
        <section className="account-card">
          <h3>1. Identificación del Comercio y Alcance</h3>
          <p>
            El presente documento regula el acceso, navegación, creación de cuentas de usuario y las
            operaciones de compraventa de hardware, periféricos y accesorios tecnológicos realizadas
            a través de la plataforma oficial de <strong>BSP Store Colombia</strong>. Al registrarse
            o confirmar un pedido, el consumidor declara haber leído y aceptado de manera libre,
            previa y expresa estos Términos y Condiciones, conforme a la legislación de la República
            de Colombia.
          </p>
        </section>

        <section className="account-card">
          <h3>2. Precios, Moneda Oficial y Disponibilidad de Inventario</h3>
          <p>
            Todos los precios publicados en <strong>BSP Store Colombia</strong> están expresados en{' '}
            <strong>Pesos Colombianos ($ COP)</strong> e incluyen los impuestos aplicables en el
            territorio nacional. El valor final del pedido se desglosa de forma transparente antes
            del pago, indicando subtotal de productos, descuentos por cupones promocionales y tarifa
            de entrega según la ubicación del destinatario.
          </p>
          <p style={{ marginTop: '10px' }}>
            La disponibilidad de unidades se valida al momento de confirmar la orden. En caso de
            presentarse alguna novedad extraordinaria de inventario sobre un producto pagado, BSP
            Store informará de inmediato al comprador para coordinar el envío prioritario o el
            reintegro total del dinero conforme al <strong>Artículo 50 de la Ley 1480 de 2011</strong>.
          </p>
        </section>

        <section className="account-card">
          <h3>3. Medios de Pago Autorizados en Colombia</h3>
          <p>
            BSP Store Colombia pone a disposición de sus clientes dos canales seguros de recaudo:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
            <li>
              <strong>Transferencia Inmediata mediante Llave Bre-B (@bbbsp):</strong> Canal directo
              sin comisión adicional para transferencias desde entidades financieras y billeteras
              digitales habilitadas en el sistema de pagos inmediatos en Colombia. Una vez realizada
              la transferencia a la llave oficial <strong>@bbbsp</strong>, el comprador registra el
              número de comprobante en su orden para su validación y despacho.
            </li>
            <li>
              <strong>Pasarela de Pagos Wompi Colombia:</strong> Para pagos con débito bancario{' '}
              <strong>PSE</strong>, tarjetas de crédito, tarjetas débito y otros medios electrónicos
              habilitados. Todas las transacciones se procesan bajo estándares de seguridad
              financiera y firma criptográfica de integridad.
            </li>
          </ul>
        </section>

        <section className="account-card">
          <h3>4. Política de Entregas: Domicilio Local y Envíos Nacionales</h3>
          <p>
            La modalidad logística se asigna automáticamente según el departamento y municipio de
            destino seleccionados por el comprador:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
            <li>
              <strong>Envíos Locales (Domicilio Local):</strong> Para entregas en{' '}
              <strong>Bogotá D. C.</strong> y municipios de cobertura local inmediata, el pedido se
              entrega mediante nuestro servicio de <strong>Domicilio Local</strong> directo (sin
              intermediación de transportadoras nacionales), con tiempos estimados de{' '}
              <strong>1 a 2 días hábiles</strong> una vez confirmado el pago.
            </li>
            <li>
              <strong>Envíos Nacionales (32 Departamentos de Colombia):</strong> Para destinos fuera
              del área de cobertura local, el despacho se realiza de forma asegurada a través de
              empresas transportadoras nacionales aliadas (<strong>Servientrega</strong>,{' '}
              <strong>Coordinadora</strong>, <strong>Inter Rapidísimo</strong> o{' '}
              <strong>Envía</strong>), suministrando al cliente el número de guía para su
              seguimiento en línea. El tiempo estimado es de <strong>2 a 6 días hábiles</strong>{' '}
              según el municipio de destino.
            </li>
          </ul>
        </section>

        <section className="account-card">
          <h3>5. Derecho de Retracto (Artículo 47 — Ley 1480 de 2011)</h3>
          <p>
            De conformidad con el <strong>Artículo 47 del Estatuto del Consumidor (Ley 1480 de 2011)</strong>,
            en todas las ventas realizadas a través de medios electrónicos o a distancia, el
            consumidor podrá ejercer el <strong>Derecho de Retracto</strong> dentro de los{' '}
            <strong>cinco (5) días hábiles</strong> contados a partir de la entrega del producto.
          </p>
          <p style={{ marginTop: '10px' }}>
            El consumidor deberá devolver el producto a BSP Store por los mismos medios y en las
            mismas condiciones en que lo recibió (sin señales de uso indebido, con todos sus
            accesorios, manuales y empaques originales). Los costos de transporte y los demás que
            conlleve la devolución del bien serán cubiertos por el consumidor. BSP Store devolverá
            en dinero todas las sumas pagadas sin hacer descuentos ni retenciones en un plazo máximo
            de <strong>treinta (30) días calendario</strong> desde el momento en que se ejerció el
            derecho.
          </p>
        </section>

        <section className="account-card">
          <h3>6. Reversión del Pago (Artículo 51 — Ley 1480 de 2011 y Decreto 587 de 2016)</h3>
          <p>
            Cuando la adquisición de productos se haya realizado mediante mecanismos de comercio
            electrónico tales como tarjeta de crédito, débito o PSE, los participantes del proceso
            de pago deberán reversar los pagos que solicite el consumidor cuando sea objeto de
            fraude, o corresponda a una operación no solicitada, o el producto adquirido no sea
            recibido, o el producto entregado no corresponda a lo solicitado o sea defectuoso.
          </p>
          <p style={{ marginTop: '10px' }}>
            Para que proceda la reversión del pago, el consumidor deberá presentar queja ante BSP
            Store y devolver el producto (cuando aplique) dentro de los{' '}
            <strong>cinco (5) días hábiles</strong> siguientes a la fecha en que tuvo noticia de la
            operación fraudulenta o no solicitada, o en que debió haber recibido el producto o lo
            recibió defectuoso o sin que correspondiera a lo solicitado, y notificar al emisor del
            instrumento de pago electrónico utilizado.
          </p>
        </section>

        <section className="account-card">
          <h3>7. Garantía Legal sobre Productos Tecnológicos</h3>
          <p>
            Todos los productos comercializados por BSP Store Colombia son 100 % originales y
            cuentan con la <strong>Garantía Legal</strong> prevista en los{' '}
            <strong>Artículos 7 al 16 de la Ley 1480 de 2011</strong> por defectos de fabricación o
            idoneidad. El trámite de garantía comprende, según corresponda técnicamente, la
            reparación gratuita del bien, su reposición por uno nuevo de iguales especificaciones o
            la devolución del dinero pagado. No constituyen causal de garantía los daños ocasionados
            por golpes, humedad, modificaciones no autorizadas, sobrecargas eléctricas o uso
            contrario a las instrucciones del fabricante.
          </p>
        </section>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '8px',
          }}
        >
          <Link href="/privacidad" className="btn btn-secondary">
            <Icon name="shield" size={18} />
            Ver Política de Tratamiento de Datos (Ley 1581 de 2012)
          </Link>
          <Link href="/cuenta" className="btn btn-primary">
            Volver a Mi Cuenta
            <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
