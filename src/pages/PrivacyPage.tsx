import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const PrivacyPage: React.FC = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Política de Privacidad — Bodega Santa María';
    return () => { document.title = prev; };
  }, []);

  return (
  <div className="privacy-page">
    <header className="privacy-header">
      <Link to="/login" className="privacy-back">
        <span className="material-icons-round">arrow_back</span>
        Volver al acceso
      </Link>
      <div className="privacy-brand">
        <span className="material-icons-round">local_bar</span>
        <span>Bodega Santa María</span>
      </div>
    </header>

    <article className="privacy-card">
      <div className="gold-line" />
      <h1>Política de Privacidad de Bodega SantaMaria</h1>
      <p className="privacy-updated">
        <strong>Última actualización:</strong> Julio de 2026
      </p>

      <p>
        En <strong>VIZIA S.A.C.</strong> nos tomamos muy en serio la privacidad y la seguridad de los
        datos. Esta Política de Privacidad describe cómo se maneja la información dentro de nuestra
        plataforma <strong>Bodega SantaMaria</strong> (aplicación web y móvil; en adelante, &quot;la
        Aplicación&quot;).
      </p>

      <h2>1. Información del Responsable del Tratamiento</h2>
      <p>El responsable del tratamiento de los datos administrados a través de la Aplicación es:</p>
      <ul>
        <li>
          <strong>Razón Social:</strong> VIZIA S.A.C.
        </li>
        <li>
          <strong>Domicilio fiscal:</strong> Jiron FAUSTINO SANCHEZ CARRIÓN 157 DPTO. 1109, Lima -
          15086, Perú (PE)
        </li>
        <li>
          <strong>Correo electrónico de contacto:</strong>{' '}
          <a href="mailto:admin@viz-ia.com">admin@viz-ia.com</a>
        </li>
      </ul>

      <h2>2. Datos que Recopilamos</h2>
      <p>Para el correcto funcionamiento de la Aplicación, únicamente se procesan los siguientes datos:</p>
      <ul>
        <li>
          <strong>Datos de autenticación:</strong> Correo electrónico y contraseña asignados por la
          administración para permitir el acceso controlado al sistema. La aplicación no permite el
          registro o creación de cuentas públicas.
        </li>
        <li>
          <strong>Datos de operación y producción:</strong> Información técnica y operativa de los
          procesos de producción de la bodega de vino que el usuario autorizado ingresa, modifica o
          visualiza en cumplimiento de sus labores.
        </li>
      </ul>
      <p>
        <strong>Nota importante:</strong> La Aplicación NO recopila información personal sensible del
        dispositivo del usuario (como ubicación GPS, lista de contactos, archivos del teléfono o uso de
        la cámara). Tampoco rastreamos ni compartimos el comportamiento del usuario con fines
        comerciales.
      </p>

      <h2>3. Finalidad del Tratamiento de Datos</h2>
      <p>
        La información recopilada se utiliza exclusivamente para los siguientes fines empresariales e
        internos:
      </p>
      <ul>
        <li>
          Validar la identidad del operario o usuario autorizado para permitir un inicio de sesión
          seguro.
        </li>
        <li>
          Proveer las funciones operativas de la app: gestionar procesos productivos e inventario de la
          bodega.
        </li>
        <li>
          Garantizar la integridad y trazabilidad de los datos de producción ingresados en el sistema.
        </li>
      </ul>

      <h2>4. Almacenamiento y Seguridad de los Datos</h2>
      <p>
        Toda la información se almacena y gestiona de manera centralizada y controlada a través de los
        servicios en la nube de <strong>Supabase</strong>. Implementamos medidas de seguridad técnicas
        y organizativas para proteger las credenciales de acceso y los datos de la bodega contra accesos
        no autorizados o alteraciones.
      </p>

      <h2>5. Compartición de Datos con Terceros</h2>
      <p>
        La Aplicación no monetiza, no contiene publicidad (Ads) ni comparte información con terceras
        empresas. Los datos únicamente son alojados por nuestro proveedor de infraestructura de base de
        datos (Supabase) bajo estrictas normas de confidencialidad, y solo se revelarían ante
        requerimientos legales formales de las autoridades peruanas competentes.
      </p>

      <h2>6. Derechos ARCO y Eliminación de Accesos</h2>
      <p>
        De conformidad con la Ley N° 29733 (Ley de Protección de Datos Personales de Perú), los usuarios
        tienen derecho a acceder a sus datos, rectificarlos o solicitar la cancelación de los mismos.
        Dado que las cuentas son de uso interno y administrado, para solicitar la desactivación de sus
        credenciales de acceso o la eliminación de su información vinculada, el usuario puede enviar una
        solicitud a: <a href="mailto:admin@viz-ia.com">admin@viz-ia.com</a>.
      </p>

      <h2>7. Menores de Edad</h2>
      <p>
        Esta Aplicación es una herramienta estrictamente laboral y profesional para la gestión de
        bodegas, por lo que no está dirigida a menores de edad ni al público general.
      </p>

      <h2>8. Cambios a esta Política de Privacidad</h2>
      <p>
        Nos reservamos el derecho de actualizar esta política para adaptarla a futuras versiones de la
        Aplicación (por ejemplo, la futura integración de permisos de cámara para lectura de códigos).
        Cualquier modificación será notificada a los usuarios y se reflejará en la fecha de &quot;Última
        actualización&quot;.
      </p>

      <footer className="privacy-footer">
        <p>
          © 2026 VIZIA S.A.C. Todos los derechos reservados.
          <br />
          Lima, Perú.
        </p>
      </footer>
    </article>
  </div>
  );
};

export default PrivacyPage;
