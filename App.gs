/**
 * ARCHIVO: App.gs
 * Punto de entrada de la aplicación Web App.
 *
 * Responsabilidad:
 * - Servir la interfaz principal.
 *
 * No debe contener:
 * - lógica de clientes 
 * - lógica de eventos
 * - acceso directo a Google Sheets
 * - lógica de navegación
 */
function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('CRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ARCHIVO: App.gs
 * Punto de entrada de la aplicación Web App.
 *
 * Responsabilidad:
 * - Servir la interfaz principal.
 * - Incluir archivos HTML del frontend.
 *
 * No debe contener:
 * - lógica de clientes
 * - lógica de eventos
 * - acceso directo a Google Sheets
 * - lógica de navegación
 */


/**
 * Punto de entrada de la Web App.
 */
function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('CRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * Incluye el contenido de otro archivo HTML
 * dentro de una plantilla HTML.
 *
 * Ejemplo:
 * <?!= include('CSS'); ?>
 *
 * @param {string} nombreArchivo Nombre del archivo HTML
 * sin la extensión .html.
 * @returns {string}
 */
function include(nombreArchivo) {
  return HtmlService
    .createHtmlOutputFromFile(nombreArchivo)
    .getContent();
}
