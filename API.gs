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


function apiBuscarClientes(termino) {

  return Cliente.buscar(
    termino
  );
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

function apiCrearEvento(datos, permitirCruce) {

  return Evento.crear(
    datos,
    permitirCruce
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


/**
 * VENTAS
 */

function apiObtenerVentas() {

  return Venta.obtenerTodas();
}


function apiObtenerVentasCliente(idCliente) {

  return Venta.obtenerPorCliente(
    idCliente
  );
}


function apiObtenerVenta(idVenta) {

  return Venta.obtenerPorId(
    idVenta
  );
}


function apiCrearVenta(datos) {

  return Venta.crear(
    datos
  );
}


function apiActualizarVenta(datos) {

  return Venta.actualizar(
    datos
  );
}
