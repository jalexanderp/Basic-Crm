/**
 * ARCHIVO: API.gs
 *
 * Capa pública de comunicación entre frontend
 * y backend.
 *
 * Responsabilidad:
 * Exponer funciones para google.script.run.
 * Delegar las operaciones a los módulos.
 *
 * No debe contener:
 * - lógica de negocio.
 * - acceso directo a Google Sheets.
 * - lógica de Calendar.
 * - manipulación de datos.
 * - lógica de interfaz.
 */


/**
 * CLIENTES
 */

function apiObtenerClientes() {

  return Cliente.obtenerTodos();
}


function apiObtenerCliente(idCliente) {

  return Cliente.obtenerPorId(
    idCliente
  );
}


function apiCrearCliente(datos) {

  return Cliente.crear(
    datos
  );
}


function apiActualizarCliente(datos) {

  return Cliente.actualizar(
    datos
  );
}


/**
 * EVENTOS
 */

function apiCrearEvento(datos) {

  return Evento.crear(
    datos
  );
}


function apiObtenerEventos(idCliente) {

  return Evento.obtenerPorCliente(
    idCliente
  );
}


function apiActualizarEvento(datos) {

  return Evento.actualizar(
    datos
  );
}
