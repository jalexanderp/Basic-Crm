/**
 * ARCHIVO: Config.gs
 * Configuración central del CRM.
 *
 * Responsabilidad:
 * - Centralizar nombres de hojas.
 * - Centralizar prefijos de IDs.
 *
 * No debe contener:
 * - lógica de negocio
 * - acceso a Google Sheets
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
    EVENTO: 'EVE-'
  }
};
