/**
 * ARCHIVO: Evento.gs
 *
 * Responsabilidad:
 * - Crear eventos CRM.
 * - Obtener eventos de un cliente.
 * - Actualizar eventos existentes.
 * - Leer y escribir la hoja EVENTOS.
 * - Generar IDs.
 * - Validar datos.
 * - Coordinar la creación de seguimientos
 *   con CalendarTrabajo.
 *
 * No contiene:
 * - HTML.
 * - lógica de interfaz.
 * - código directo de Google Calendar.
 *
 * La integración con Calendar pertenece a:
 * CalendarTrabajo.gs
 */

const Evento = {

  NOMBRE_HOJA: 'EVENTOS',

  COLUMNAS: {
    ID_EVENTO: 0,
    ID_CLIENTE: 1,
    FECHA_REGISTRO: 2,
    HORA_REGISTRO: 3,
    NOMBRE_CLIENTE: 4,
    TIPO_EVENTO: 5,
    COMENTARIO: 6,
    REQUIERE_SEGUIMIENTO: 7,
    FECHA_EVENTO: 8,
    HORA_EVENTO: 9,
    FECHA_NOTIFICACION: 10,
    RESULTADO_EVENTO: 11,
    MOTIVO_SEGUIMIENTO: 12,
    EVENTO_CALENDAR: 13
  },


  /**
   * Crea un nuevo evento CRM.
   *
   * Si requiere seguimiento:
   * - valida fecha y hora;
   * - verifica disponibilidad;
   * - crea la cita en Calendar;
   * - guarda su ID.
   *
   * Si NO requiere seguimiento:
   * - solo guarda el evento en EVENTOS;
   * - no crea nada en Calendar.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  crear(datos) {

    this._validarDatos(datos);

    const lock =
      LockService.getScriptLock();

    lock.waitLock(10000);

    let idEventoCalendar = '';

    try {

      const hoja =
        Spreadsheet.obtenerHoja(
          this.NOMBRE_HOJA
        );

      const cliente =
        Cliente.obtenerPorId(
          datos.idCliente
        );

      if (!cliente) {

        throw new Error(
          'El cliente indicado no existe.'
        );
      }

      const idEvento =
        this._generarNuevoId(
          hoja
        );

      const ahora =
        new Date();

      const seguimiento =
        this._texto(
          datos.requiereSeguimiento
        );

      /*
       * Solo convertimos fecha y hora
       * cuando existe seguimiento.
       */
      const fechaEvento =
        seguimiento === 'Sí'
          ? this._convertirFecha(
              datos.fechaEvento
            )
          : '';

      const horaEvento =
        seguimiento === 'Sí'
          ? this._formatearHora(
              datos.horaEvento
            )
          : '';

      let fechaNotificacion = '';

      /*
       * Solo existe fecha de notificación
       * cuando se crea un seguimiento.
       */
      if (
        seguimiento === 'Sí'
      ) {

        fechaNotificacion =
          this._calcularFechaNotificacion(
            fechaEvento,
            datos.horaEvento
          );
      }

      const horaRegistro =
        Utilities.formatDate(
          ahora,
          Session.getScriptTimeZone(),
          'h:mm a'
        );

      /*
       * ID de Calendar vacío por defecto.
       */
      let datosCalendar = null;

      /*
       * CALENDAR
       *
       * Solo se crea una cita cuando el evento
       * requiere seguimiento.
       */
      if (
        seguimiento === 'Sí'
      ) {

        datosCalendar = {

          idEvento:
            idEvento,

          idCliente:
            cliente.idCliente,

          nombreCliente:
            cliente.nombreCompleto,

          tipoEvento:
            datos.tipoEvento,

          comentario:
            datos.comentario,

          resultadoEvento:
            datos.resultadoEvento,

          motivoSeguimiento:
            datos.motivoSeguimiento,

          fechaEvento:
            datos.fechaEvento,

          horaEvento:
            datos.horaEvento
        };

        const eventoCalendar =
          CalendarTrabajo.crearEvento(
            datosCalendar
          );

        idEventoCalendar =
          eventoCalendar.id;
      }

      /*
       * Construimos la fila de EVENTOS.
       */
      const fila = [

        idEvento,

        cliente.idCliente,

        ahora,

        horaRegistro,

        cliente.nombreCompleto,

        this._texto(
          datos.tipoEvento
        ),

        this._texto(
          datos.comentario
        ),

        seguimiento,

        fechaEvento,

        horaEvento,

        fechaNotificacion,

        this._texto(
          datos.resultadoEvento
        ),

        seguimiento === 'Sí'
          ? this._texto(
              datos.motivoSeguimiento
            )
          : '',

        idEventoCalendar
      ];

      /*
       * Guardamos el evento CRM.
       */
      hoja.appendRow(
        fila
      );

      return this._formatearEvento(
        fila
      );

    } catch (error) {

      /*
       * Si Calendar fue creado pero falló
       * el guardado en Sheets, intentamos
       * eliminar el evento para no dejar
       * compromisos huérfanos.
       */
      if (idEventoCalendar) {

        try {

          CalendarTrabajo.eliminarEvento(
            idEventoCalendar
          );

        } catch (errorCalendar) {

          console.error(
            'No fue posible revertir el evento de Calendar: ' +
            errorCalendar.message
          );
        }
      }

      throw error;

    } finally {

      lock.releaseLock();
    }
  },


  /**
   * Obtiene todos los eventos de un cliente.
   *
   * @param {string} idCliente
   * @returns {Array<Object>}
   */
  obtenerPorCliente(idCliente) {

    if (!idCliente) {

      throw new Error(
        'El ID del cliente es obligatorio.'
      );
    }

    const hoja =
      Spreadsheet.obtenerHoja(
        this.NOMBRE_HOJA
      );

    const datos =
      hoja.getDataRange().getValues();

    if (datos.length <= 1) {
      return [];
    }

    const indice =
      this.COLUMNAS.ID_CLIENTE;

    const eventos = [];

    for (
      let i = 1;
      i < datos.length;
      i++
    ) {

      const fila =
        datos[i];

      if (
        String(
          fila[indice]
        ) ===
        String(idCliente)
      ) {

        eventos.push(
          this._formatearEvento(
            fila
          )
        );
      }
    }

    /*
     * Más recientes primero.
     */
    eventos.reverse();

    return eventos;
  },


  /**
   * Actualiza un evento existente.
   *
   * IMPORTANTE:
   * Esta versión mantiene la regla actual:
   *
   * - No modifica la cita existente de Calendar.
   * - No modifica EVENTO_CALENDAR.
   *
   * La sincronización de modificaciones con Calendar
   * se implementará como una etapa posterior.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  actualizar(datos) {

    this._validarActualizacion(
      datos
    );

    const lock =
      LockService.getScriptLock();

    lock.waitLock(10000);

    try {

      const hoja =
        Spreadsheet.obtenerHoja(
          this.NOMBRE_HOJA
        );

      const ultimaFila =
        hoja.getLastRow();

      if (ultimaFila < 2) {

        throw new Error(
          'No existen eventos registrados.'
        );
      }

      const valores =
        hoja
          .getRange(
            2,
            1,
            ultimaFila - 1,
            this.COLUMNAS.EVENTO_CALENDAR + 1
          )
          .getValues();

      let numeroFila = -1;

      for (
        let i = 0;
        i < valores.length;
        i++
      ) {

        const idEvento =
          String(
            valores[i][
              this.COLUMNAS.ID_EVENTO
            ] || ''
          );

        if (
          idEvento ===
          String(datos.idEvento)
        ) {

          numeroFila =
            i + 2;

          break;
        }
      }

      if (numeroFila === -1) {

        throw new Error(
          'No se encontró el evento indicado.'
        );
      }

      const seguimiento =
        this._texto(
          datos.requiereSeguimiento
        );

      const fechaEvento =
        seguimiento === 'Sí'
          ? this._convertirFecha(
              datos.fechaEvento
            )
          : '';

      const horaEvento =
        seguimiento === 'Sí'
          ? this._formatearHora(
              datos.horaEvento
            )
          : '';

      const motivoSeguimiento =
        seguimiento === 'Sí'
          ? this._texto(
              datos.motivoSeguimiento
            )
          : '';

      hoja
        .getRange(
          numeroFila,
          this.COLUMNAS.COMENTARIO + 1
        )
        .setValue(
          this._texto(
            datos.comentario
          )
        );

      hoja
        .getRange(
          numeroFila,
          this.COLUMNAS.REQUIERE_SEGUIMIENTO + 1
        )
        .setValue(
          seguimiento
        );

      hoja
        .getRange(
          numeroFila,
          this.COLUMNAS.FECHA_EVENTO + 1
        )
        .setValue(
          fechaEvento
        );

      hoja
        .getRange(
          numeroFila,
          this.COLUMNAS.HORA_EVENTO + 1
        )
        .setValue(
          horaEvento
        );

      hoja
        .getRange(
          numeroFila,
          this.COLUMNAS.RESULTADO_EVENTO + 1
        )
        .setValue(
          this._texto(
            datos.resultadoEvento
          )
        );

      hoja
        .getRange(
          numeroFila,
          this.COLUMNAS.MOTIVO_SEGUIMIENTO + 1
        )
        .setValue(
          motivoSeguimiento
        );

      const filaActualizada =
        hoja
          .getRange(
            numeroFila,
            1,
            1,
            this.COLUMNAS.EVENTO_CALENDAR + 1
          )
          .getValues()[0];

      return this._formatearEvento(
        filaActualizada
      );

    } finally {

      lock.releaseLock();
    }
  },


  /**
   * Calcula la fecha/hora de notificación.
   *
   * @param {Date} fechaEvento
   * @param {string} horaEvento
   * @returns {Date|string}
   */
  _calcularFechaNotificacion(
    fechaEvento,
    horaEvento
  ) {

    if (
      !fechaEvento ||
      !horaEvento
    ) {
      return '';
    }

    const fechaHora =
      CalendarTrabajo._crearFechaHora(
        fechaEvento,
        horaEvento
      );

    const horas = 24;

    return new Date(
      fechaHora.getTime() -
      horas * 60 * 60 * 1000
    );
  },



  /**
   * Valida actualización.
   *
   * @param {Object} datos
   */
  _validarActualizacion(datos) {

    if (
      !datos ||
      typeof datos !== 'object'
    ) {

      throw new Error(
        'Los datos de actualización son obligatorios.'
      );
    }

    if (
      !this._texto(
        datos.idEvento
      )
    ) {

      throw new Error(
        'El ID del evento es obligatorio.'
      );
    }

    if (
      !this._texto(
        datos.comentario
      )
    ) {

      throw new Error(
        'El comentario es obligatorio.'
      );
    }

    if (
      !this._texto(
        datos.resultadoEvento
      )
    ) {

      throw new Error(
        'El resultado del evento es obligatorio.'
      );
    }

    const seguimiento =
      this._texto(
        datos.requiereSeguimiento
      );

    if (!seguimiento) {

      throw new Error(
        'Debe indicar si requiere seguimiento.'
      );
    }

    if (
      seguimiento !== 'Sí' &&
      seguimiento !== 'No'
    ) {

      throw new Error(
        'El valor de seguimiento no es válido.'
      );
    }

    if (
      seguimiento === 'Sí' &&
      !this._texto(
        datos.fechaEvento
      )
    ) {

      throw new Error(
        'La fecha del seguimiento es obligatoria.'
      );
    }

    if (
      seguimiento === 'Sí' &&
      !this._texto(
        datos.horaEvento
      )
    ) {

      throw new Error(
        'La hora del seguimiento es obligatoria.'
      );
    }
  },


  /**
   * Valida creación.
   *
   * @param {Object} datos
   */
  _validarDatos(datos) {

    if (
      !datos ||
      typeof datos !== 'object'
    ) {

      throw new Error(
        'Los datos del evento son obligatorios.'
      );
    }

    if (
      !this._texto(
        datos.idCliente
      )
    ) {

      throw new Error(
        'El cliente es obligatorio.'
      );
    }

    if (
      !this._texto(
        datos.tipoEvento
      )
    ) {

      throw new Error(
        'El tipo de evento es obligatorio.'
      );
    }

    if (
      !this._texto(
        datos.comentario
      )
    ) {

      throw new Error(
        'El comentario es obligatorio.'
      );
    }

    const seguimiento =
      this._texto(
        datos.requiereSeguimiento
      );

    if (!seguimiento) {

      throw new Error(
        'Debe indicar si requiere seguimiento.'
      );
    }

    if (
      seguimiento !== 'Sí' &&
      seguimiento !== 'No'
    ) {

      throw new Error(
        'El valor de seguimiento no es válido.'
      );
    }

    if (
      !this._texto(
        datos.resultadoEvento
      )
    ) {

      throw new Error(
        'El resultado del evento es obligatorio.'
      );
    }

    /*
     * Fecha y hora solo son obligatorias
     * cuando se requiere seguimiento.
     */
    if (
      seguimiento === 'Sí' &&
      !this._texto(
        datos.fechaEvento
      )
    ) {

      throw new Error(
        'La fecha del seguimiento es obligatoria.'
      );
    }

    if (
      seguimiento === 'Sí' &&
      !this._texto(
        datos.horaEvento
      )
    ) {

      throw new Error(
        'La hora del seguimiento es obligatoria.'
      );
    }
  },


  /**
   * Genera el siguiente ID.
   *
   * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
   * @returns {string}
   */
  _generarNuevoId(hoja) {

    const ultimaFila =
      hoja.getLastRow();

    if (ultimaFila < 2) {
      return 'EVE-000001';
    }

    const valores =
      hoja
        .getRange(
          2,
          this.COLUMNAS.ID_EVENTO + 1,
          ultimaFila - 1,
          1
        )
        .getValues();

    let mayor = 0;

    valores.forEach(fila => {

      const id =
        String(
          fila[0] || ''
        );

      const coincidencia =
        id.match(
          /^EVE-(\d+)$/
        );

      if (!coincidencia) {
        return;
      }

      const numero =
        Number(
          coincidencia[1]
        );

      if (numero > mayor) {
        mayor = numero;
      }
    });

    return 'EVE-' +
      String(
        mayor + 1
      ).padStart(
        6,
        '0'
      );
  },


  /**
   * Convierte una fecha recibida desde el frontend.
   *
   * Acepta:
   * - YYYY-MM-DD
   * - Date
   *
   * @param {*} valor
   * @returns {Date|string}
   */
  _convertirFecha(valor) {

    if (!valor) {
      return '';
    }

    if (
      Object.prototype.toString.call(valor) ===
      '[object Date]'
    ) {

      if (isNaN(valor.getTime())) {
        throw new Error(
          'La fecha indicada no es válida.'
        );
      }

      return valor;
    }

    const texto =
      String(valor).trim();

    /*
    * Fecha proveniente de <input type="date">
    * Formato esperado: YYYY-MM-DD
    *
    * Se construye manualmente para evitar
    * conversiones UTC y problemas de zona horaria.
    */
    const coincidencia =
      texto.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

    if (!coincidencia) {

      throw new Error(
        'La fecha indicada no es válida.'
      );
    }

    const anio =
      Number(coincidencia[1]);

    const mes =
      Number(coincidencia[2]);

    const dia =
      Number(coincidencia[3]);

    if (
      mes < 1 ||
      mes > 12 ||
      dia < 1 ||
      dia > 31
    ) {

      throw new Error(
        'La fecha indicada no es válida.'
      );
    }

    const fecha =
      new Date(
        anio,
        mes - 1,
        dia,
        0,
        0,
        0,
        0
      );

    /*
    * Validación adicional para detectar fechas
    * inexistentes, por ejemplo 31/02/2026.
    */
    if (
      fecha.getFullYear() !== anio ||
      fecha.getMonth() !== mes - 1 ||
      fecha.getDate() !== dia
    ) {

      throw new Error(
        'La fecha indicada no es válida.'
      );
    }

    return fecha;
  },



  /**
   * Convierte valor a texto.
   *
   * @param {*} valor
   * @returns {string}
   */
  _texto(valor) {

    return String(
      valor ?? ''
    ).trim();
  },


  /**
   * Convierte fila a objeto.
   *
   * @param {Array} fila
   * @returns {Object}
   */
  _formatearEvento(fila) {

    return {

      idEvento:
        String(
          fila[
            this.COLUMNAS.ID_EVENTO
          ] || ''
        ),

      idCliente:
        String(
          fila[
            this.COLUMNAS.ID_CLIENTE
          ] || ''
        ),

      fechaRegistro:
        this._formatearFecha(
          fila[
            this.COLUMNAS.FECHA_REGISTRO
          ]
        ),

      horaRegistro:
        this._formatearHora(
          fila[
            this.COLUMNAS.HORA_REGISTRO
          ]
        ),

      nombreCliente:
        String(
          fila[
            this.COLUMNAS.NOMBRE_CLIENTE
          ] || ''
        ),

      tipoEvento:
        String(
          fila[
            this.COLUMNAS.TIPO_EVENTO
          ] || ''
        ),

      comentario:
        String(
          fila[
            this.COLUMNAS.COMENTARIO
          ] || ''
        ),

      requiereSeguimiento:
        String(
          fila[
            this.COLUMNAS.REQUIERE_SEGUIMIENTO
          ] || ''
        ),

      fechaEvento:
        this._formatearFecha(
          fila[
            this.COLUMNAS.FECHA_EVENTO
          ]
        ),

      horaEvento:
        this._formatearHora(
          fila[
            this.COLUMNAS.HORA_EVENTO
          ]
        ),

      fechaNotificacion:
        this._formatearFecha(
          fila[
            this.COLUMNAS.FECHA_NOTIFICACION
          ]
        ),

      resultadoEvento:
        String(
          fila[
            this.COLUMNAS.RESULTADO_EVENTO
          ] || ''
        ),

      motivoSeguimiento:
        String(
          fila[
            this.COLUMNAS.MOTIVO_SEGUIMIENTO
          ] || ''
        ),

      eventoCalendar:
        String(
          fila[
            this.COLUMNAS.EVENTO_CALENDAR
          ] || ''
        )
    };
  },


  /**
   * Formatea fecha.
   *
   * @param {*} valor
   * @returns {string}
   */
  _formatearFecha(valor) {

    if (!valor) {
      return '';
    }

    if (
      Object.prototype.toString.call(valor) !==
      '[object Date]'
    ) {

      return String(valor);
    }

    return Utilities.formatDate(
      valor,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy'
    );
  },


  /**
   * Formatea hora.
   *
   * @param {*} valor
   * @returns {string}
   */
  _formatearHora(valor) {

    if (!valor) {
      return '';
    }

    if (
      Object.prototype.toString.call(valor) ===
      '[object Date]'
    ) {

      return Utilities.formatDate(
        valor,
        Session.getScriptTimeZone(),
        'h:mm a'
      )
        .replace('AM', 'a.m.')
        .replace('PM', 'p.m.');
    }

    const texto =
      String(valor).trim();

    if (!texto) {
      return '';
    }

    const coincidencia =
      texto.match(
        /^(\d{1,2}):(\d{2})(?::\d{2})?$/
      );

    if (!coincidencia) {
      return texto;
    }

    const horas =
      Number(
        coincidencia[1]
      );

    const minutos =
      Number(
        coincidencia[2]
      );

    if (
      horas < 0 ||
      horas > 23 ||
      minutos < 0 ||
      minutos > 59
    ) {

      return texto;
    }

    const fecha =
      new Date();

    fecha.setHours(
      horas,
      minutos,
      0,
      0
    );

    return Utilities.formatDate(
      fecha,
      Session.getScriptTimeZone(),
      'h:mm a'
    )
      .replace('AM', 'a.m.')
      .replace('PM', 'p.m.');
  }

};
