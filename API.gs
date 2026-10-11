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

function apiObtenerClientes(offset, limit) {

  try {

    return Cliente.obtenerTodos(
      offset,
      limit
    );

  } catch (e) {

    // Log del error en el servidor
    Logger.log('ERROR en apiObtenerClientes: ' + e.message);
    Logger.log('Stack: ' + e.stack);

    // Devolver error estructurado
    return {
      error: true,
      message: e.message,
      stack: e.stack
    };
  }
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

function apiObtenerVentas(offset, limit) {

  try {

    return Venta.obtenerTodas(
      offset,
      limit
    );

  } catch (e) {

    // Log del error en el servidor
    Logger.log('ERROR en apiObtenerVentas: ' + e.message);
    Logger.log('Stack: ' + e.stack);

    // Devolver error estructurado
    return {
      error: true,
      message: e.message,
      stack: e.stack
    };
  }
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
