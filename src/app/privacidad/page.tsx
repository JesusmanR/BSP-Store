import Link from 'next/link';
import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'Política de Tratamiento de Datos Personales | BSP Store Colombia',
  description:
    'Política de Tratamiento y Protección de Datos Personales (Habeas Data) de BSP Store Colombia conforme a la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013.',
};

export default function PrivacidadPage() {
  return (
    <div className="container page">
      <Breadcrumb current="Protección de datos personales" />

      <div className="page-heading">
        <span className="eyebrow blue">HABEAS DATA COLOMBIA · LEY 1581 DE 2012</span>
        <h1>
          Política de Tratamiento de Datos Personales<span className="blue">.</span>
        </h1>
        <p>
          En cumplimiento del <strong>Artículo 15 de la Constitución Política de Colombia</strong>,
          la <strong>Ley Estatutaria 1581 de 2012</strong>, el <strong>Decreto 1377 de 2013</strong>{' '}
          y el <strong>Decreto Único Reglamentario 1074 de 2015</strong>.
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
          <h3>1. Identificación del Responsable del Tratamiento (Art. 13 Decreto 1377 de 2013)</h3>
          <p>
            <strong>BSP Store Colombia</strong> actúa como Responsable del Tratamiento de los datos
            personales recolectados a través de su tienda virtual, formularios de creación de
            cuenta, proceso de compra (Checkout) y canales de atención y asesoría:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '6px' }}>
            <li>
              <strong>Domicilio Principal:</strong> Bucaramanga, Santander, Colombia
            </li>
            <li>
              <strong>Correo Electrónico Oficial de Protección de Datos y Compras:</strong>{' '}
              compras@bspstore.com.co
            </li>
            <li>
              <strong>Teléfono / Celular / WhatsApp Oficial:</strong> 302 800 0240 (+57 302 800 0240)
            </li>
          </ul>
          <p style={{ marginTop: '10px' }}>
            Garantizamos la confidencialidad, libertad, seguridad, veracidad y transparencia en el
            manejo de la información de nuestros usuarios y clientes en toda Colombia.
          </p>
        </section>

        <section className="account-card">
          <h3>2. Datos Personales Recolectados</h3>
          <p>
            Bajo el principio de minimización de datos, recolectamos únicamente la información
            estrictamente necesaria para la relación comercial y la entrega de tus pedidos:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
            <li>
              <strong>Datos de identificación y contacto:</strong> Nombre completo, dirección de
              correo electrónico, número de teléfono celular y, cuando sea requerido para
              facturación, tipo y número de documento de identidad.
            </li>
            <li>
              <strong>Datos de ubicación y entrega:</strong> Departamento, ciudad o municipio,
              dirección física e indicaciones adicionales para el servicio de{' '}
              <strong>Domicilio Local</strong> o el despacho por transportadora nacional.
            </li>
            <li>
              <strong>Datos transaccionales:</strong> Historial de pedidos, referencias de
              comprobantes de transferencia a la <strong>Llave Bre-B (@bbbsp)</strong> y referencias
              de estado emitidas por la pasarela <strong>Wompi</strong> (BSP Store nunca almacena
              números completos de tarjetas de crédito ni códigos CVV).
            </li>
          </ul>
        </section>

        <section className="account-card">
          <h3>3. Finalidades del Tratamiento de los Datos</h3>
          <p>
            Los datos personales autorizados por el Titular al crear su cuenta o realizar una compra
            serán tratados para las siguientes finalidades legítimas:
          </p>
          <ol style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
            <li>
              Crear y administrar la cuenta del usuario, permitiendo guardar sus direcciones de
              entrega frecuentes y consultar el estado de sus pedidos.
            </li>
            <li>
              Procesar, verificar y despachar las órdenes de compra mediante{' '}
              <strong>Domicilio Local</strong> o a través de empresas de transporte nacional
              cuando el destino sea fuera del área local.
            </li>
            <li>
              Verificar transferencias realizadas a la <strong>Llave Bre-B (@bbbsp)</strong> y
              confirmar transacciones procesadas por <strong>Wompi Colombia</strong>.
            </li>
            <li>
              Atender solicitudes de garantía legal, derecho de retracto, reversión de pago,
              consultas técnicas y asesoría personalizada para el setup del cliente.
            </li>
            <li>
              Dar cumplimiento a obligaciones contables, tributarias y regulatorias ante las
              autoridades colombianas competentes.
            </li>
          </ol>
        </section>

        <section className="account-card">
          <h3>4. Derechos de los Titulares (Derechos ARCO — Artículo 8, Ley 1581 de 2012)</h3>
          <p>
            Como Titular de tus datos personales en Colombia, tienes derecho en todo momento y de
            manera gratuita a:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'grid', gap: '8px' }}>
            <li>
              <strong>Conocer y Acceder:</strong> Consultar de forma gratuita tus datos personales
              que hayan sido objeto de tratamiento y descargar tu historial desde la sección{' '}
              <strong>Mi Cuenta</strong>.
            </li>
            <li>
              <strong>Actualizar y Rectificar:</strong> Modificar tus datos de contacto o editar y
              eliminar cualquiera de tus direcciones guardadas cuando sean parciales, inexactos o
              incompletos.
            </li>
            <li>
              <strong>Solicitar Prueba de la Autorización:</strong> Conocer la fecha y versión del
              consentimiento otorgado al registrarte en BSP Store.
            </li>
            <li>
              <strong>Revocar la Autorización y Solicitar la Supresión:</strong> Solicitar la
              eliminación de tu cuenta y la supresión de tus datos personales cuando no exista un
              deber legal o contractual que exija su conservación.
            </li>
            <li>
              <strong>Presentar Quejas ante la SIC:</strong> Acudir ante la{' '}
              <strong>Superintendencia de Industria y Comercio (SIC)</strong> por infracciones a lo
              dispuesto en la Ley 1581 de 2012.
            </li>
          </ul>
        </section>

        <section className="account-card">
          <h3>5. Procedimiento para el Ejercicio de Derechos (Consultas y Reclamos)</h3>
          <p>
            El Titular o sus causahabientes pueden ejercer sus derechos directamente desde el panel
            de autogestión en{' '}
            <Link href="/cuenta" style={{ color: '#168BFF', fontWeight: 700 }}>
              Mi Cuenta
            </Link>{' '}
            (edición/eliminación de direcciones, descarga de datos personales y solicitud de
            supresión), escribiendo al correo oficial{' '}
            <a
              href="mailto:compras@bspstore.com.co"
              style={{ color: '#168BFF', fontWeight: 700 }}
            >
              compras@bspstore.com.co
            </a>
            , comunicándose al WhatsApp/celular{' '}
            <a
              href="https://wa.me/573028000240"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#168BFF', fontWeight: 700 }}
            >
              302 800 0240
            </a>{' '}
            o a través de nuestra página de{' '}
            <Link href="/contacto" style={{ color: '#168BFF', fontWeight: 700 }}>
              Contacto
            </Link>
            .
          </p>
          <p style={{ marginTop: '10px' }}>
            Conforme a los <strong>Artículos 14 y 15 de la Ley 1581 de 2012</strong>, las consultas
            serán atendidas en un término máximo de <strong>diez (10) días hábiles</strong> y los
            reclamos o solicitudes de corrección/supresión en un término máximo de{' '}
            <strong>quince (15) días hábiles</strong> contados a partir del día siguiente a la fecha
            de su recibo.
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
          <Link href="/terminos" className="btn btn-secondary">
            <Icon name="lock" size={18} />
            Ver Términos y Condiciones (Ley 1480 de 2011)
          </Link>
          <Link href="/cuenta" className="btn btn-primary">
            Ir a Mi Cuenta y Privacidad
            <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
