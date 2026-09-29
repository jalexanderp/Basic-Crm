/**
 * ARCHIVO: Venta.gs
 * Lógica de negocio relacionada con ventas.
 *
 * Responsabilidad:
 * - Leer ventas desde la hoja VENTAS.
 * - Convertir filas de Sheets en objetos de venta.
 * - Listar todas las ventas y las ventas de un cliente.
 * - Validar y crear nuevas ventas.
 * - Actualizar ventas existentes.
 * - Generar IDs de venta de forma segura.
 * - Disparar la generación de eventos automáticos de postventa
 *   a partir de la fecha de venta.
 *
 * No debe contener:
 * - HTML.
 * - lógica de navegación.
 * - lógica de interfaz.
 * - código de google.script.run.
 */

const Venta = {

  NOMBRE_HOJA: 'VENTAS',

  COLUMNAS: {
    ID_VENTA: 0,
    ID_CLIENTE: 1,
    FACTURA: 2,
    NOMBRE_CLIENTE: 3,
    FECHA_VENTA: 4,
    VEHICULO_VENDIDO: 5,
    VALOR_VEHICULO: 6,
    COMENTARIOS: 7,
    VALOR_FINANCIADO: 8,
    ENTIDAD_FINANCIERA: 9,
    VEHICULO_RETOMA: 10,
    VALOR_RETOMA: 11
  },


  /**
   * Obtiene todas las ventas.
   *
   * Se devuelven ordenadas desde la más reciente hasta la más antigua
   * según la fecha de venta.
   *
   * @returns {Array<Object>}
   */
  obtenerTodas() {

    const hoja =
      Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

    const valores =
      hoja.getDataRange().getValues();

    if (valores.length <= 1) {
      return [];
    }

    const filas = valores
      .slice(1)
      .filter(fila =>
        fila.some(valor => valor !== '')
      );

    filas.sort((a, b) => {

      const fechaA =
        this._valorFechaOrdenamiento(
          a[this.COLUMNAS.FECHA_VENTA]
        );

      const fechaB =
        this._valorFechaOrdenamiento(
          b[this.COLUMNAS.FECHA_VENTA]
        );

      return fechaB - fechaA;
    });

    return filas.map(
      fila => this._filaAObjeto(fila)
    );
  },


  /**
   * Obtiene las ventas de un cliente.
   *
   * @param {string} idCliente
   * @returns {Array<Object>}
   */
  obtenerPorCliente(idCliente) {

    const idBuscado =
      Utils.texto(idCliente);

    if (!idBuscado) {
      return [];
    }

    const hoja =
      Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

    const valores =
      hoja.getDataRange().getValues();

    if (valores.length <= 1) {
      return [];
    }

    const indice = this.COLUMNAS.ID_CLIENTE;

    const ventas = valores
      .slice(1)
      .filter(fila =>
        Utils.texto(fila[indice]) === idBuscado
      )
      .map(fila => this._filaAObjeto(fila));

    // Más recientes primero.
    ventas.sort((a, b) => {
      const fechaA = this._valorFechaOrdenamiento(a.fechaVenta);
      const fechaB = this._valorFechaOrdenamiento(b.fechaVenta);
      return fechaB - fechaA;
    });

    return ventas;
  },


  /**
   * Devuelve un mapa { idCliente: true } con los clientes que tienen
   * al menos una venta registrada. Lee la hoja VENTAS una sola vez.
   *
   * @returns {Object}
   */
  clientesConVenta() {

    const mapa = {};

    const hoja =
      Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

    const valores =
      hoja.getDataRange().getValues();

    if (valores.length <= 1) {
      return mapa;
    }

    const indice = this.COLUMNAS.ID_CLIENTE;

    for (let i = 1; i < valores.length; i++) {
      const idCliente = Utils.texto(valores[i][indice]);
      if (idCliente) {
        mapa[idCliente] = true;
      }
    }

    return mapa;
  },


  /**
   * Obtiene una venta por su ID.
   *
   * @param {string} idVenta
   * @returns {Object|null}
   */
  obtenerPorId(idVenta) {

    const idBuscado =
      Utils.texto(idVenta);

    if (!idBuscado) {
      return null;
    }

    const hoja =
      Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

    const ultimaFila =
      hoja.getLastRow();

    if (ultimaFila < 2) {
      return null;
    }

    const valores =
      hoja
        .getRange(
          2,
          1,
          ultimaFila - 1,
          this.COLUMNAS.VALOR_RETOMA + 1
        )
        .getValues();

    for (let i = 0; i < valores.length; i++) {
      if (Utils.texto(valores[i][0]) === idBuscado) {
        return this._filaAObjeto(valores[i]);
      }
    }

    return null;
  },


  /**
   * Crea una nueva venta.
   *
   * Campos obligatorios: idCliente y fechaVenta.
   * Al crearse, se generan los eventos automáticos de postventa
   * a partir de la fecha de venta.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  crear(datos) {

    const datosNormalizados =
      this._normalizarDatos(datos);

    this._validarDatos(datosNormalizados);

    const lock =
      LockService.getScriptLock();

    lock.waitLock(30000);

    try {

      const hoja =
        Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

      // Verificar que el cliente exista y tomar su nombre.
      const cliente =
        Cliente.obtenerPorId(datosNormalizados.idCliente);

      if (!cliente) {
        throw new Error('El cliente indicado no existe.');
      }

      const ultimaFila =
        hoja.getLastRow();

      const idsExistentes =
        ultimaFila > 1
          ? hoja
              .getRange(2, 1, ultimaFila - 1, 1)
              .getValues()
              .map(fila => fila[0])
          : [];

      const idVenta =
        Utils.generarSiguienteId(
          idsExistentes,
          CONFIG.IDS.VENTA
        );

      const fila = [
        idVenta,
        cliente.idCliente,
        datosNormalizados.factura,
        cliente.nombreCompleto,
        datosNormalizados.fechaVenta,
        datosNormalizados.vehiculoVendido,
        datosNormalizados.valorVehiculo,
        datosNormalizados.comentarios,
        datosNormalizados.valorFinanciado,
        datosNormalizados.entidadFinanciera,
        datosNormalizados.vehiculoRetoma,
        datosNormalizados.valorRetoma
      ];

      hoja.appendRow(fila);

      const ventaNueva = this._filaAObjeto(fila);

      // Generar eventos automáticos de postventa a partir de la venta.
      this._generarPostventa(cliente, ventaNueva);

      return ventaNueva;

    } finally {
      lock.releaseLock();
    }
  },


  /**
   * Actualiza una venta existente.
   *
   * Si tiene fecha de venta, regenera los eventos de postventa
   * (los recalcula sobre la fecha de venta actual).
   *
   * @param {Object} datos
   * @returns {Object}
   */
  actualizar(datos) {

    if (!datos || typeof datos !== 'object') {
      throw new Error('Los datos de la venta son obligatorios.');
    }

    const idVenta =
      Utils.texto(datos.idVenta);

    if (!idVenta) {
      throw new Error('El ID de la venta es obligatorio.');
    }

    const datosNormalizados =
      this._normalizarDatos(datos);

    this._validarDatos(datosNormalizados);

    const lock =
      LockService.getScriptLock();

    lock.waitLock(30000);

    try {

      const hoja =
        Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

      const cliente =
        Cliente.obtenerPorId(datosNormalizados.idCliente);

      if (!cliente) {
        throw new Error('El cliente indicado no existe.');
      }

      const ultimaFila =
        hoja.getLastRow();

      if (ultimaFila < 2) {
        throw new Error('No existen ventas registradas.');
      }

      const ids =
        hoja
          .getRange(2, 1, ultimaFila - 1, 1)
          .getValues();

      let numeroFila = -1;

      for (let i = 0; i < ids.length; i++) {
        if (Utils.texto(ids[i][0]) === idVenta) {
          numeroFila = i + 2;
          break;
        }
      }

      if (numeroFila === -1) {
        throw new Error('No se encontró la venta indicada.');
      }

      // Actualizamos desde la columna FACTURA (3) hasta VALOR_RETOMA (12).
      // No se modifican ID Venta ni ID Cliente.
      const datosFila = [
        datosNormalizados.factura,
        cliente.nombreCompleto,
        datosNormalizados.fechaVenta,
        datosNormalizados.vehiculoVendido,
        datosNormalizados.valorVehiculo,
        datosNormalizados.comentarios,
        datosNormalizados.valorFinanciado,
        datosNormalizados.entidadFinanciera,
        datosNormalizados.vehiculoRetoma,
        datosNormalizados.valorRetoma
      ];

      hoja
        .getRange(
          numeroFila,
          this.COLUMNAS.FACTURA + 1,
          1,
          datosFila.length
        )
        .setValues([datosFila]);

      const filaActualizada =
        hoja
          .getRange(
            numeroFila,
            1,
            1,
            this.COLUMNAS.VALOR_RETOMA + 1
          )
          .getValues()[0];

      const ventaActualizada =
        this._filaAObjeto(filaActualizada);

      // Regenerar eventos de postventa con la fecha de venta actual.
      this._generarPostventa(cliente, ventaActualizada);

      return ventaActualizada;

    } finally {
      lock.releaseLock();
    }
  },


  /**
   * Dispara la generación de eventos automáticos de postventa
   * a partir de la fecha de venta.
   *
   * @param {Object} cliente
   * @param {Object} venta
   */
  _generarPostventa(cliente, venta) {

    if (!venta || !venta.fechaVenta) {
      return;
    }

    // Delegamos en Evento, que sabe crear/actualizar los seguimientos
    // de postventa (3/6/12 meses) sobre la fecha indicada.
    Evento.actualizarEventosPostventa(cliente, venta.fechaVenta);
  },


  /**
   * Normaliza los datos recibidos.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  _normalizarDatos(datos) {

    datos = datos || {};

    return {
      idCliente:
        Utils.texto(datos.idCliente),

      factura:
        Utils.texto(datos.factura),

      fechaVenta:
        this._normalizarFecha(datos.fechaVenta),

      vehiculoVendido:
        Utils.texto(datos.vehiculoVendido),

      valorVehiculo:
        this._numero(datos.valorVehiculo),

      comentarios:
        Utils.texto(datos.comentarios),

      valorFinanciado:
        this._numero(datos.valorFinanciado),

      entidadFinanciera:
        Utils.texto(datos.entidadFinanciera),

      vehiculoRetoma:
        Utils.texto(datos.vehiculoRetoma),

      valorRetoma:
        this._numero(datos.valorRetoma)
    };
  },


  /**
   * Valida los datos obligatorios (FK y fecha de venta).
   *
   * @param {Object} datos
   */
  _validarDatos(datos) {

    const errores = [];

    if (!datos.idCliente) {
      errores.push('El cliente es obligatorio.');
    }

    if (!this._esFechaValida(datos.fechaVenta)) {
      errores.push('La fecha de venta es obligatoria y debe ser válida.');
    }

    if (errores.length > 0) {
      throw new Error(errores.join(' '));
    }
  },


  /**
   * Convierte un valor a número (o '' si no aplica).
   *
   * Acepta números y cadenas con separadores comunes (puntos/comas/espacios).
   *
   * @param {*} valor
   * @returns {number|string}
   */
  _numero(valor) {

    if (valor === null || valor === undefined || valor === '') {
      return '';
    }

    if (typeof valor === 'number') {
      return isNaN(valor) ? '' : valor;
    }

    // Quitar separadores de miles y espacios; usar punto decimal.
    const limpio = String(valor)
      .replace(/[\s.]/g, '')
      .replace(/,/g, '.');

    const n = Number(limpio);

    return isNaN(n) ? '' : n;
  },


  /**
   * Convierte una fecha recibida (frontend o Sheets) a Date en hora local.
   *
   * @param {*} valor
   * @returns {Date|string}
   */
  _normalizarFecha(valor) {

    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return valor;
    }

    const texto = Utils.texto(valor);

    if (!texto) {
      return '';
    }

    const partes = texto.split('-');
    if (partes.length !== 3) {
      return '';
    }

    const anio = Number(partes[0]);
    const mes = Number(partes[1]);
    const dia = Number(partes[2].substring(0, 2));

    if (
      !Number.isInteger(anio) ||
      !Number.isInteger(mes) ||
      !Number.isInteger(dia)
    ) {
      return '';
    }

    // Hora local a mediodía para evitar desfases de zona horaria.
    const fecha = new Date(anio, mes - 1, dia, 12, 0, 0, 0);

    if (
      fecha.getFullYear() !== anio ||
      fecha.getMonth() !== mes - 1 ||
      fecha.getDate() !== dia
    ) {
      return '';
    }

    return fecha;
  },


  /**
   * Comprueba si un valor es un Date válido.
   *
   * @param {*} valor
   * @returns {boolean}
   */
  _esFechaValida(valor) {
    return valor instanceof Date && !isNaN(valor.getTime());
  },


  /**
   * Convierte una fila de VENTAS en un objeto de venta.
   *
   * Los valores de fecha se devuelven como texto (yyyy-MM-dd) para que
   * el objeto sea serializable sin problemas hacia el frontend.
   *
   * @param {Array} fila
   * @returns {Object}
   */
  _filaAObjeto(fila) {

    return {
      idVenta:
        Utils.texto(fila[this.COLUMNAS.ID_VENTA]),

      idCliente:
        Utils.texto(fila[this.COLUMNAS.ID_CLIENTE]),

      factura:
        Utils.texto(fila[this.COLUMNAS.FACTURA]),

      nombreCliente:
        Utils.texto(fila[this.COLUMNAS.NOMBRE_CLIENTE]),

      fechaVenta:
        Utils.fecha(fila[this.COLUMNAS.FECHA_VENTA]),

      vehiculoVendido:
        Utils.texto(fila[this.COLUMNAS.VEHICULO_VENDIDO]),

      valorVehiculo:
        this._textoNumero(fila[this.COLUMNAS.VALOR_VEHICULO]),

      comentarios:
        Utils.texto(fila[this.COLUMNAS.COMENTARIOS]),

      valorFinanciado:
        this._textoNumero(fila[this.COLUMNAS.VALOR_FINANCIADO]),

      entidadFinanciera:
        Utils.texto(fila[this.COLUMNAS.ENTIDAD_FINANCIERA]),

      vehiculoRetoma:
        Utils.texto(fila[this.COLUMNAS.VEHICULO_RETOMA]),

      valorRetoma:
        this._textoNumero(fila[this.COLUMNAS.VALOR_RETOMA])
    };
  },


  /**
   * Convierte un valor numérico a texto (o '' si está vacío).
   *
   * @param {*} valor
   * @returns {string|number}
   */
  _textoNumero(valor) {

    if (valor === null || valor === undefined || valor === '') {
      return '';
    }

    if (typeof valor === 'number') {
      return valor;
    }

    return Utils.texto(valor);
  },


  /**
   * Obtiene un valor numérico para ordenar por fecha de venta.
   *
   * @param {*} valor
   * @returns {number}
   */
  _valorFechaOrdenamiento(valor) {

    if (this._esFechaValida(valor)) {
      return valor.getTime();
    }

    const fecha = new Date(valor);

    if (!isNaN(fecha.getTime())) {
      return fecha.getTime();
    }

    return 0;
  }

};
