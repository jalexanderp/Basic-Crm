/**
 * ARCHIVO: Config.gs
 * Configuración central del CRM.
 *
 * Responsabilidad:
 * - Centralizar nombres de hojas.
 * - Centralizar prefijos de IDs.
 * - Leer parámetros de la hoja CONFIGURACION.
 *
 * No debe contener:
 * - lógica específica de negocio
 * - funciones de clientes
 * - funciones de eventos
 * - lógica de interfaz
 */

const CONFIG = {
  HOJAS: {
    CLIENTES: 'CLIENTES',
    EVENTOS: 'EVENTOS',
    VENTAS: 'VENTAS',
    CONFIGURACION: 'CONFIGURACION'
  },

  IDS: {
    CLIENTE: 'CLI-',
    EVENTO: 'EVE-',
    VENTA: 'VEN-'
  }
};


/**
 * Objeto Config para leer los parámetros de la hoja CONFIGURACION.
 *
 * La hoja CONFIGURACION tiene la siguiente estructura:
 * - Fila 1: nombres de los parámetros (encabezados) en columnas A, B, C...
 * - Fila 2: valores de los parámetros en columnas A, B, C...
 */
const Config = {

  /**
   * Lee todos los parámetros de la hoja CONFIGURACION.
   *
   * @returns {Object} Un objeto { nombreParametro: valor, ... }
   */
  leerParametros() {

    const hoja = Spreadsheet.obtenerHoja(CONFIG.HOJAS.CONFIGURACION);

    const datos = hoja.getDataRange().getValues();

    if (datos.length < 2) {
      return {};
    }

    // Fila 1 (índice 0): Nombres de los parámetros (encabezados)
    const encabezados = datos[0];

    // Fila 2 (índice 1): Valores de los parámetros
    const valores = datos[1];

    const parametros = {};

    // Recorrer las columnas y asociar encabezado con valor
    for (let i = 0; i < encabezados.length; i++) {
      const nombreParametro = String(encabezados[i] || '')
        .trim()
        .replace(/\s+/g, ' ');

      // No usamos .trim() en el valor para NO perder el texto de los
      // mensajes. Solo recortamos saltos de línea al inicio y final.
      const valorParametro = String(valores[i] == null ? '' : valores[i]).trim();

      if (nombreParametro) {
        parametros[nombreParametro] = valorParametro;
      }
    }

    return parametros;
  },


  /**
   * Lee un parámetro específico de la hoja CONFIGURACION.
   *
   * La búsqueda ignora mayúsculas/minúsculas y espacios adicionales.
   *
   * @param {string} nombreParametro Nombre del parámetro a leer.
   * @param {*} valorPorDefecto Valor a devolver si no se encuentra.
   * @returns {*}
   */
  obtenerParametro(nombreParametro, valorPorDefecto) {

    const parametros = this.leerParametros();

    const nombreBuscado = this._clave(nombreParametro);

    for (const clave in parametros) {
      if (this._clave(clave) === nombreBuscado) {
        const valor = parametros[clave];

        // Convertir a número si el valor es puramente numérico
        if (/^\d+$/.test(String(valor).trim())) {
          return parseInt(valor, 10);
        }

        return valor;
      }
    }

    return valorPorDefecto;
  },


  /**
   * Normaliza una clave para comparación robusta:
   * - recorta espacios
   * - colapsa espacios múltiples
   * - normaliza Unicode (NFD) y elimina marcas diacríticas (acentos, ñ→n)
   * - pasa a minúsculas
   *
   * Esto evita que diferencias invisibles de codificación (por ejemplo
   * la "ñ" compuesta de dos formas distintas) impidan encontrar el parámetro.
   *
   * @param {*} texto
   * @returns {string}
   */
  _clave(texto) {
    let s = String(texto == null ? '' : texto)
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

    // Normalizar acentos y ñ si el motor lo soporta.
    try {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
      // Si normalize no está disponible, continuamos con la cadena base.
    }

    return s;
  }
};



/**
 * FUNCIÓN DE DIAGNÓSTICO (ejecutar manualmente desde el editor de Apps Script).
 *
 * Muestra en el registro (Logs) exactamente qué parámetros y valores
 * se están leyendo de la hoja CONFIGURACION, y prueba la lectura del
 * mensaje de cumpleaños.
 *
 * Para usarla:
 * 1. Selecciona "diagnosticarConfiguracion" en el editor de Apps Script.
 * 2. Ejecuta y revisa "Ver > Registros" (Ctrl+Enter).
 */
function diagnosticarConfiguracion() {

  const parametros = Config.leerParametros();

  Logger.log('=== CLAVES ENCONTRADAS EN CONFIGURACION ===');
  for (const clave in parametros) {
    Logger.log('Clave: [' + clave + '] (longitud: ' + clave.length + ')');
    Logger.log('   Valor: [' + parametros[clave] + ']');
  }

  Logger.log('=== PRUEBA DE LECTURA DEL MENSAJE DE CUMPLEAÑOS ===');
  const mensaje = Config.obtenerParametro('Mensaje de cumpleaños', 'NO_ENCONTRADO');
  Logger.log('Mensaje de cumpleaños: [' + mensaje + ']');
}
