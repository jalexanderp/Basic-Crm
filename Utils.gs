/**
 * ARCHIVO: Utils.gs
 * Utilidades compartidas del CRM.
 *
 * Responsabilidad:
 * - Proporcionar funciones pequeñas y reutilizables.
 * - Normalizar valores.
 * - Generar IDs secuenciales.
 * - Formatear fechas de forma consistente.
 *
 * No debe contener:
 * - lógica específica de clientes
 * - lógica específica de eventos
 * - acceso directo a hojas
 * - lógica de interfaz
 *
 * Las funciones de este archivo deben mantenerse genéricas.
 */

const Utils = {

  /**
   * Convierte un valor a texto limpio.
   *
   * @param {*} valor Valor recibido.
   * @returns {string}
   */
  texto(valor) {
    if (valor === null || valor === undefined) {
      return '';
    }

    return String(valor).trim();
  },


  /**
   * Comprueba si un valor es un objeto Date válido.
   *
   * @param {*} valor Valor a comprobar.
   * @returns {boolean}
   */
  esFecha(valor) {
    return valor instanceof Date && !isNaN(valor.getTime());
  },


  /**
   * Formatea una fecha como yyyy-MM-dd.
   *
   * Utiliza la zona horaria configurada en el proyecto
   * de Google Apps Script.
   *
   * @param {*} valor Fecha a formatear.
   * @returns {string}
   */
  fecha(valor) {
    if (!this.esFecha(valor)) {
      return '';
    }

    return Utilities.formatDate(
      valor,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  },


  /**
   * Formatea una fecha y hora como yyyy-MM-dd HH:mm:ss.
   *
   * Utiliza la zona horaria configurada en el proyecto
   * de Google Apps Script.
   *
   * @param {*} valor Fecha a formatear.
   * @returns {string}
   */
  fechaHora(valor) {
    if (!this.esFecha(valor)) {
      return '';
    }

    return Utilities.formatDate(
      valor,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    );
  },


  /**
   * Genera el siguiente ID secuencial a partir de los IDs
   * existentes en una columna.
   *
   * Ejemplo:
   * CLI-000001
   * CLI-000002
   * CLI-000003
   *
   * Resultado:
   * CLI-000004
   *
   * @param {Array} valores Valores existentes en la columna de IDs.
   * @param {string} prefijo Prefijo del ID, por ejemplo "CLI-".
   * @returns {string}
   */
  generarSiguienteId(valores, prefijo) {
    let mayorNumero = 0;

    valores.forEach(valor => {
      const id = this.texto(valor);

      if (!id.startsWith(prefijo)) {
        return;
      }

      const numero = parseInt(
        id.substring(prefijo.length),
        10
      );

      if (!isNaN(numero) && numero > mayorNumero) {
        mayorNumero = numero;
      }
    });

    const siguienteNumero = mayorNumero + 1;

    return prefijo + String(siguienteNumero).padStart(6, '0');
  },


  /**
   * Reemplaza las variables de plantilla dentro de un texto.
   *
   * Variables soportadas (no distingue mayúsculas/minúsculas):
   * - {PRIMER_NOMBRE}
   * - {NOMBRE_COMPLETO}
   * - {CELULAR}
   *
   * @param {string} plantilla Texto con variables, por ejemplo:
   *   "Hola {PRIMER_NOMBRE}, ¡feliz cumpleaños!"
   * @param {Object} datos Objeto con los valores a insertar.
   * @returns {string} Texto con las variables reemplazadas.
   */
  aplicarPlantilla(plantilla, datos) {

    let texto = this.texto(plantilla);

    if (!texto) {
      return '';
    }

    datos = datos || {};

    const reemplazos = {
      'PRIMER_NOMBRE': this.texto(datos.primerNombre),
      'NOMBRE_COMPLETO': this.texto(datos.nombreCompleto),
      'CELULAR': this.texto(datos.celular)
    };

    for (const variable in reemplazos) {
      // Construimos una expresión regular para {VARIABLE}
      // ignorando mayúsculas/minúsculas.
      const patron = new RegExp('\\{' + variable + '\\}', 'gi');
      texto = texto.replace(patron, reemplazos[variable]);
    }

    return texto;
  },


  /**
   * Codifica un texto para usarlo de forma segura dentro de una URL.
   *
   * Es un envoltorio de encodeURIComponent que además garantiza que
   * el valor recibido se trate como cadena y nunca sea null/undefined.
   *
   * @param {*} valor Texto a codificar.
   * @returns {string} Texto codificado para URL.
   */
  urlEncode(valor) {
    return encodeURIComponent(this.texto(valor));
  },


  /**
   * Construye un enlace de WhatsApp (wa.me / api.whatsapp.com) a partir
   * de un número de celular y un mensaje ya listo para enviar.
   *
   * El mensaje se codifica con urlEncode para que caracteres como
   * espacios, acentos, "ñ", signos "¡" "!" o "?" no rompan la URL.
   *
   * @param {string} celular Número de teléfono (solo dígitos y/o "+").
   * @param {string} mensaje Mensaje ya con las variables reemplazadas.
   * @returns {string} URL de WhatsApp, o cadena vacía si faltan datos.
   */
  generarUrlWhatsApp(celular, mensaje) {

    const numero = this.texto(celular).replace(/[^\d+]/g, '');
    const textoMensaje = this.texto(mensaje);

    if (!numero || !textoMensaje) {
      return '';
    }

    return 'https://api.whatsapp.com/send/?phone=' +
      this.urlEncode(numero) +
      '&text=' +
      this.urlEncode(textoMensaje) +
      '&type=phone_number&app_absent=0';
  },


  /**
   * Lee una plantilla de mensaje desde la hoja CONFIGURACION, reemplaza
   * sus variables con los datos del cliente y devuelve tanto el texto
   * final como el enlace de WhatsApp listo para usar.
   *
   * @param {string} nombreParametro Nombre del parámetro en CONFIGURACION,
   *   por ejemplo "Mensaje de cumpleaños".
   * @param {Object} cliente Objeto cliente con primerNombre, celular, etc.
   * @param {string} [mensajePorDefecto] Texto a usar si el parámetro no existe.
   * @returns {{ mensaje: string, linkWhatsApp: string }}
   */
  construirMensajeWhatsApp(nombreParametro, cliente, mensajePorDefecto) {

    cliente = cliente || {};

    // 1. Leer la plantilla desde la hoja CONFIGURACION.
    const plantilla = Config.obtenerParametro(
      nombreParametro,
      mensajePorDefecto || ''
    );

    // 2. Reemplazar las variables de la plantilla.
    const mensaje = this.aplicarPlantilla(plantilla, cliente);

    // 3. Generar el enlace de WhatsApp con el mensaje codificado.
    const linkWhatsApp = this.generarUrlWhatsApp(
      cliente.celular,
      mensaje
    );

    return {
      mensaje: mensaje,
      linkWhatsApp: linkWhatsApp
    };
  }
};
