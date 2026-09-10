/**
 * ARCHIVO: Spreadsheet.gs
 * Acceso centralizado al archivo de Google Sheets.
 *
 * Responsabilidad:
 * - Obtener el Spreadsheet del proyecto.
 * - Obtener hojas por nombre.
 *
 * No debe contener:
 * - lógica de clientes
 * - lógica de eventos
 * - validaciones de negocio
 * - lógica de interfaz
 * - construcción de HTML
 */

const Spreadsheet = {

  /**
   * Devuelve el Spreadsheet asociado al proyecto.
   *
   * @returns {SpreadsheetApp.Spreadsheet}
   */
  obtener() {
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  /**
   * Devuelve una hoja por su nombre.
   *
   * @param {string} nombre Nombre definido en CONFIG.HOJAS.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  obtenerHoja(nombre) {
    const hoja = this.obtener().getSheetByName(nombre);

    if (!hoja) {
      throw new Error(`No se encontró la hoja: ${nombre}`);
    }

    return hoja;
  }
};
