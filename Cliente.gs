/**
 * ARCHIVO: Cliente.gs
 * Lógica de negocio relacionada con clientes.
 *
 * Responsabilidad:
 * - Leer clientes desde la hoja CLIENTES.
 * - Convertir filas de Sheets en objetos de cliente.
 * - Buscar clientes por ID.
 * - Buscar clientes por nombre o celular.
 * - Validar y crear nuevos clientes.
 * - Actualizar clientes existentes.
 * - Generar IDs de cliente de forma segura.
 *
 * No debe contener:
 * - HTML.
 * - lógica de navegación.
 * - lógica de interfaz.
 * - código de google.script.run.
 * - lógica relacionada con eventos.
 */

const Cliente = {

  /**
   * Obtiene los clientes existentes.
   *
   * Los clientes se devuelven ordenados desde el
   * más reciente hasta el más antiguo según
   * la fecha de registro.
   *
   * @returns {Array<Object>}
   */
  obtenerTodos() {

    const hoja =
      Spreadsheet.obtenerHoja(
        CONFIG.HOJAS.CLIENTES
      );

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
        this._valorFechaOrdenamiento(a[1]);

      const fechaB =
        this._valorFechaOrdenamiento(b[1]);

      return fechaB - fechaA;
    });

    return filas.map(
      fila => this._filaAObjeto(fila)
    );
  },


  /**
   * Busca clientes por nombre completo
   * o celular.
   *
   * La búsqueda se realiza directamente
   * sobre todos los registros de Sheets.
   *
   * @param {string} termino
   * @returns {Array<Object>}
   */
  buscar(termino) {

    const textoBuscado =
      Utils.texto(termino).toLowerCase();

    if (!textoBuscado) {
      return [];
    }

    const hoja =
      Spreadsheet.obtenerHoja(
        CONFIG.HOJAS.CLIENTES
      );

    const ultimaFila =
      hoja.getLastRow();

    if (ultimaFila < 2) {
      return [];
    }

    const valores =
      hoja
        .getRange(
          2,
          1,
          ultimaFila - 1,
          13
        )
        .getValues();

    const resultados =
      valores.filter(fila => {

        const nombre =
          Utils.texto(
            fila[4]
          ).toLowerCase();

        const celular =
          Utils.texto(
            fila[5]
          ).toLowerCase();

        return (
          nombre.includes(textoBuscado) ||
          celular.includes(textoBuscado)
        );
      });

    resultados.sort((a, b) => {

      const fechaA =
        this._valorFechaOrdenamiento(a[1]);

      const fechaB =
        this._valorFechaOrdenamiento(b[1]);

      return fechaB - fechaA;
    });

    return resultados.map(
      fila => this._filaAObjeto(fila)
    );
  },


  /**
   * Obtiene un cliente por su ID.
   *
   * Esta función NO utiliza obtenerTodos().
   *
   * De esta forma, abrir una ficha individual
   * no obliga a construir y enviar todos los
   * clientes al frontend.
   *
   * @param {string} idCliente
   * @returns {Object|null}
   */
  obtenerPorId(idCliente) {

    const idBuscado =
      Utils.texto(idCliente);

    if (!idBuscado) {
      return null;
    }

    const hoja =
      Spreadsheet.obtenerHoja(
        CONFIG.HOJAS.CLIENTES
      );

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
          13
        )
        .getValues();

    for (let i = 0; i < valores.length; i++) {

      const idFila =
        Utils.texto(
          valores[i][0]
        );

      if (idFila === idBuscado) {

        return this._filaAObjeto(
          valores[i]
        );
      }
    }

    return null;
  },


  /**
   * Crea un nuevo cliente.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  crear(datos) {

    const datosNormalizados =
      this._normalizarDatos(datos);

    this._validarDatosCrear(
      datosNormalizados
    );

    const lock =
      LockService.getScriptLock();

    lock.waitLock(30000);

    try {

      const hoja =
        Spreadsheet.obtenerHoja(
          CONFIG.HOJAS.CLIENTES
        );

      const ultimaFila =
        hoja.getLastRow();

      const idsExistentes =
        ultimaFila > 1
          ? hoja
              .getRange(
                2,
                1,
                ultimaFila - 1,
                1
              )
              .getValues()
              .map(fila => fila[0])
          : [];

      const idCliente =
        Utils.generarSiguienteId(
          idsExistentes,
          CONFIG.IDS.CLIENTE
        );

      const fechaRegistro =
        new Date();

      const fila = [

        idCliente,

        fechaRegistro,

        'Lead',

        datosNormalizados.primerNombre,

        datosNormalizados.nombreCompleto,

        datosNormalizados.celular,

        datosNormalizados.email,

        datosNormalizados.fechaNacimiento,

        datosNormalizados.primerVehiculoInteres,

        datosNormalizados.segundoVehiculoInteres,

        datosNormalizados.primerVehiculoRetoma,

        datosNormalizados.segundoVehiculoRetoma,

        datosNormalizados.infoAdicional
      ];

      hoja.appendRow(fila);

      return this._filaAObjeto(fila);

    } finally {

      lock.releaseLock();
    }
  },


  /**
   * Actualiza un cliente existente.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  actualizar(datos) {

    if (
      !datos ||
      typeof datos !== 'object'
    ) {
      throw new Error(
        'Los datos del cliente son obligatorios.'
      );
    }

    const idCliente =
      Utils.texto(datos.idCliente);

    if (!idCliente) {
      throw new Error(
        'El ID del cliente es obligatorio.'
      );
    }

    const datosNormalizados =
      this._normalizarDatos(datos);

    this._validarDatosCrear(
      datosNormalizados
    );

    const lock =
      LockService.getScriptLock();

    lock.waitLock(30000);

    try {

      const hoja =
        Spreadsheet.obtenerHoja(
          CONFIG.HOJAS.CLIENTES
        );

      const ultimaFila =
        hoja.getLastRow();

      if (ultimaFila < 2) {
        throw new Error(
          'No existen clientes registrados.'
        );
      }

      const ids =
        hoja
          .getRange(
            2,
            1,
            ultimaFila - 1,
            1
          )
          .getValues();

      let numeroFila = -1;

      for (
        let i = 0;
        i < ids.length;
        i++
      ) {

        const idFila =
          Utils.texto(
            ids[i][0]
          );

        if (idFila === idCliente) {

          numeroFila = i + 2;
          break;
        }
      }

      if (numeroFila === -1) {
        throw new Error(
          'No se encontró el cliente indicado.'
        );
      }

      const datosFila = [

        datosNormalizados.primerNombre,

        datosNormalizados.nombreCompleto,

        datosNormalizados.celular,

        datosNormalizados.email,

        datosNormalizados.fechaNacimiento,

        datosNormalizados.primerVehiculoInteres,

        datosNormalizados.segundoVehiculoInteres,

        datosNormalizados.primerVehiculoRetoma,

        datosNormalizados.segundoVehiculoRetoma,

        datosNormalizados.infoAdicional
      ];

      hoja
        .getRange(
          numeroFila,
          4,
          1,
          10
        )
        .setValues([
          datosFila
        ]);

      const filaActualizada =
        hoja
          .getRange(
            numeroFila,
            1,
            1,
            13
          )
          .getValues()[0];

      return this._filaAObjeto(
        filaActualizada
      );

    } finally {

      lock.releaseLock();
    }
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

      primerNombre:
        Utils.texto(
          datos.primerNombre
        ),

      nombreCompleto:
        Utils.texto(
          datos.nombreCompleto
        ),

      celular:
        Utils.texto(
          datos.celular
        ),

      email:
        Utils.texto(
          datos.email
        ),

      fechaNacimiento:
        this._normalizarFecha(
          datos.fechaNacimiento
        ),

      primerVehiculoInteres:
        Utils.texto(
          datos.primerVehiculoInteres
        ),

      segundoVehiculoInteres:
        Utils.texto(
          datos.segundoVehiculoInteres
        ),

      primerVehiculoRetoma:
        Utils.texto(
          datos.primerVehiculoRetoma
        ),

      segundoVehiculoRetoma:
        Utils.texto(
          datos.segundoVehiculoRetoma
        ),

      infoAdicional:
        Utils.texto(
          datos.infoAdicional
        )
    };
  },


  /**
   * Convierte una fecha recibida desde frontend.
   *
   * @param {*} valor
   * @returns {Date|string}
   */
  _normalizarFecha(valor) {

    if (
      valor instanceof Date &&
      !isNaN(valor.getTime())
    ) {
      return valor;
    }

    const texto =
      Utils.texto(valor);

    if (!texto) {
      return '';
    }

    const partes =
      texto.split('-');

    if (partes.length !== 3) {
      return '';
    }

    const anio =
      Number(partes[0]);

    const mes =
      Number(partes[1]);

    const dia =
      Number(partes[2]);

    if (
      !Number.isInteger(anio) ||
      !Number.isInteger(mes) ||
      !Number.isInteger(dia)
    ) {
      return '';
    }

    const fecha =
      new Date(
        anio,
        mes - 1,
        dia
      );

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
   * Valida los datos necesarios.
   *
   * @param {Object} datos
   */
  _validarDatosCrear(datos) {

    const errores = [];

    if (!datos.primerNombre) {

      errores.push(
        'El primer nombre es obligatorio.'
      );
    }

    if (!datos.nombreCompleto) {

      errores.push(
        'El nombre completo es obligatorio.'
      );
    }

    if (!datos.celular) {

      errores.push(
        'El celular es obligatorio.'
      );
    }

    if (!datos.primerVehiculoInteres) {

      errores.push(
        'El primer vehículo de interés es obligatorio.'
      );
    }

    if (
      datos.fechaNacimiento &&
      !this._esFechaValida(
        datos.fechaNacimiento
      )
    ) {

      errores.push(
        'La fecha de nacimiento no es válida.'
      );
    }

    if (errores.length > 0) {

      throw new Error(
        errores.join(' ')
      );
    }
  },


  /**
   * Comprueba si una fecha es válida.
   *
   * @param {*} valor
   * @returns {boolean}
   */
  _esFechaValida(valor) {

    return (
      valor instanceof Date &&
      !isNaN(valor.getTime())
    );
  },


  /**
   * Convierte una fila de CLIENTES
   * en un objeto cliente.
   *
   * @param {Array} fila
   * @returns {Object}
   */
  _filaAObjeto(fila) {

    return {

      idCliente:
        Utils.texto(fila[0]),

      fechaRegistro:
        Utils.fecha(fila[1]),

      tipoCliente:
        Utils.texto(fila[2]),

      primerNombre:
        Utils.texto(fila[3]),

      nombreCompleto:
        Utils.texto(fila[4]),

      celular:
        Utils.texto(fila[5]),

      email:
        Utils.texto(fila[6]),

      fechaNacimiento:
        Utils.fecha(fila[7]),

      primerVehiculoInteres:
        Utils.texto(fila[8]),

      segundoVehiculoInteres:
        Utils.texto(fila[9]),

      primerVehiculoRetoma:
        Utils.texto(fila[10]),

      segundoVehiculoRetoma:
        Utils.texto(fila[11]),

      infoAdicional:
        Utils.texto(fila[12])
    };
  },


  /**
   * Obtiene un valor numérico para ordenar
   * las filas por fecha de registro.
   *
   * @param {*} valor
   * @returns {number}
   */
  _valorFechaOrdenamiento(valor) {

    if (this._esFechaValida(valor)) {
      return valor.getTime();
    }

    const fecha =
      new Date(valor);

    if (!isNaN(fecha.getTime())) {
      return fecha.getTime();
    }

    return 0;
  }

};
