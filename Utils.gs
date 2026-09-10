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
  }
};
