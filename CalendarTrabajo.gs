/**
 * ARCHIVO: CalendarTrabajo.gs
 *
 * Integración con Google Calendar.
 *
 * Responsabilidad:
 * - Obtener el calendario "Trabajo".
 * - Validar disponibilidad.
 * - Aplicar una holgura de 1 hora.
 * - Crear seguimientos de 1 hora.
 * - Configurar recordatorios.
 * - Eliminar un evento de Calendar si es necesario revertirlo.
 *
 * No debe contener:
 * - lógica de clientes.
 * - lógica de eventos de Sheets.
 * - HTML.
 * - lógica de interfaz.
 */

const CalendarTrabajo = {

  /*
   * ID REAL del calendario "Trabajo".
   *
   * Se utiliza el ID en lugar del nombre para evitar
   * problemas si existen varios calendarios o si
   * posteriormente se cambia el nombre.
   */
  ID_CALENDARIO:
    'a5697dd20a4a23af4cf7e44007974cdb75a564481a9e2b5e17a4d70f43486bb6@group.calendar.google.com',

  /*
   * Nombre utilizado únicamente como referencia
   * y para mensajes de error.
   */
  NOMBRE_CALENDARIO:
    'Trabajo',

  /*
   * Los seguimientos siempre duran una hora.
   */
  DURACION_MINUTOS:
    60,

  /*
   * Debe existir una hora libre antes y después
   * del seguimiento.
   */
  HOLGURA_MINUTOS:
    60,

  /*
   * Por ahora dejamos el recordatorio fijo.
   *
   * Posteriormente podremos volver a leerlo
   * desde CONFIGURACION.
   */
  HORAS_RECORDATORIO:
    24,


  /**
   * Crea una cita de seguimiento en Calendar.
   *
   * Este método solamente debe llamarse cuando
   * el evento requiere seguimiento.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  crearEvento(datos) {

    if (!datos || typeof datos !== 'object') {

      throw new Error(
        'Los datos del calendario son obligatorios.'
      );
    }

    const calendario =
      this._obtenerCalendario();

    const fechaInicio =
      this._crearFechaHora(
        datos.fechaEvento,
        datos.horaEvento
      );

    const fechaFin =
      new Date(
        fechaInicio.getTime() +
        this.DURACION_MINUTOS *
        60 *
        1000
      );

    /*
     * Validamos disponibilidad considerando
     * una holgura completa de una hora.
     *
     * Ejemplo:
     *
     * Seguimiento:
     * 10:15 - 11:15
     *
     * Ventana protegida:
     * 09:15 - 12:15
     */
    this._validarDisponibilidad(
      calendario,
      fechaInicio,
      fechaFin
    );

    const minutosRecordatorio =
      24 * 60;

    const titulo =
      this._crearTitulo(datos);

    const descripcion =
      this._crearDescripcion(datos);

    /*
     * Creamos el evento.
     */
    const evento =
      calendario.createEvent(
        titulo,
        fechaInicio,
        fechaFin,
        {
          description:
            descripcion
        }
      );

    /*
     * Eliminamos los recordatorios que
     * Calendar pudiera haber aplicado
     * por configuración predeterminada.
     */
    evento.removeAllReminders();

    /*
     * Agregamos nuestro único recordatorio.
     *
     * Actualmente:
     * 24 horas antes.
     */
    if (
      minutosRecordatorio > 0
    ) {

      evento.addEmailReminder(
        minutosRecordatorio
      );
    }

    return {

      id:
        evento.getId(),

      titulo:
        titulo,

      fechaInicio:
        fechaInicio,

      fechaFin:
        fechaFin,

      minutosRecordatorio:
        minutosRecordatorio
    };
  },


  /**
   * Elimina un evento de Calendar.
   *
   * Se utiliza para revertir una operación
   * si posteriormente falla el guardado
   * en Sheets.
   *
   * @param {string} idEventoCalendar
   */
  eliminarEvento(
    idEventoCalendar
  ) {

    if (!idEventoCalendar) {
      return;
    }

    const calendario =
      this._obtenerCalendario();

    const evento =
      calendario.getEventById(
        idEventoCalendar
      );

    if (evento) {

      evento.deleteEvent();
    }
  },


  /**
   * Obtiene el calendario Trabajo
   * utilizando su ID único.
   *
   * @returns {GoogleAppsScript.Calendar.Calendar}
   */
  _obtenerCalendario() {

    const calendario =
      CalendarApp.getCalendarById(
        this.ID_CALENDARIO
      );

    if (!calendario) {

      throw new Error(
        'No se pudo acceder al calendario "' +
        this.NOMBRE_CALENDARIO +
        '".'
      );
    }

    return calendario;
  },


  /**
   * Valida disponibilidad.
   *
   * Para un seguimiento de:
   *
   * 10:15 - 11:15
   *
   * la ventana protegida será:
   *
   * 09:15 - 12:15
   *
   * Por lo tanto:
   *
   * 09:15 - 10:15
   * genera conflicto.
   *
   * 08:00 - 09:15
   * no genera conflicto.
   *
   * 11:15 - 12:15
   * genera conflicto.
   *
   * 12:15 en adelante
   * no genera conflicto.
   *
   * @param {GoogleAppsScript.Calendar.Calendar} calendario
   * @param {Date} fechaInicio
   * @param {Date} fechaFin
   */
  _validarDisponibilidad(
    calendario,
    fechaInicio,
    fechaFin
  ) {

    const margen =
      this.HOLGURA_MINUTOS *
      60 *
      1000;

    const ventanaInicio =
      new Date(
        fechaInicio.getTime() -
        margen
      );

    const ventanaFin =
      new Date(
        fechaFin.getTime() +
        margen
      );

    const eventos =
      calendario.getEvents(
        ventanaInicio,
        ventanaFin
      );

    if (
      !eventos ||
      eventos.length === 0
    ) {

      return;
    }

    const conflicto =
      eventos.find(
        evento => {

          const inicioExistente =
            evento.getStartTime();

          const finExistente =
            evento.getEndTime();

          return (
            inicioExistente <
            ventanaFin &&
            finExistente >
            ventanaInicio
          );
        }
      );

    if (!conflicto) {

      return;
    }

    const inicio =
      Utilities.formatDate(
        conflicto.getStartTime(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy h:mm a'
      );

    const fin =
      Utilities.formatDate(
        conflicto.getEndTime(),
        Session.getScriptTimeZone(),
        'h:mm a'
      );

    throw new Error(
      'No es posible agendar el seguimiento. ' +
      'Existe otro compromiso en el calendario ' +
      this.NOMBRE_CALENDARIO +
      ' entre ' +
      inicio +
      ' y ' +
      fin +
      ', considerando la holgura de 1 hora.'
    );
  },

  /**
   * Convierte fecha y hora en un objeto Date.
   *
   * Acepta:
   *
   * - Date
   * - YYYY-MM-DD
   * - DD/MM/YYYY
   *
   * La hora puede recibirse como:
   *
   * - HH:mm
   * - HH:mm:ss
   *
   * @param {string|Date} fecha
   * @param {string|Date} hora
   * @returns {Date}
   */
  _crearFechaHora(
    fecha,
    hora
  ) {

    if (!fecha) {

      throw new Error(
        'La fecha del seguimiento es obligatoria.'
      );
    }

    if (!hora) {

      throw new Error(
        'La hora del seguimiento es obligatoria.'
      );
    }

    let anio;
    let mes;
    let dia;

    /*
    * CASO 1:
    * La fecha ya viene como Date.
    */
    if (
      Object.prototype.toString.call(fecha) ===
      '[object Date]'
    ) {

      if (isNaN(fecha.getTime())) {

        throw new Error(
          'La fecha del seguimiento no es válida.'
        );
      }

      anio =
        fecha.getFullYear();

      mes =
        fecha.getMonth() + 1;

      dia =
        fecha.getDate();

    } else {

      const fechaTexto =
        String(fecha).trim();

      /*
      * CASO 2:
      * YYYY-MM-DD
      */
      let coincidencia =
        fechaTexto.match(
          /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );

      if (coincidencia) {

        anio =
          Number(
            coincidencia[1]
          );

        mes =
          Number(
            coincidencia[2]
          );

        dia =
          Number(
            coincidencia[3]
          );

      } else {

        /*
        * CASO 3:
        * DD/MM/YYYY
        */
        coincidencia =
          fechaTexto.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
          );

        if (coincidencia) {

          dia =
            Number(
              coincidencia[1]
            );

          mes =
            Number(
              coincidencia[2]
            );

          anio =
            Number(
              coincidencia[3]
            );

        } else {

          throw new Error(
            'La fecha del seguimiento no es válida.'
          );
        }
      }
    }

    /*
    * Obtenemos hora y minutos.
    */
    let horas;
    let minutos;

    /*
    * Si la hora llega como Date.
    */
    if (
      Object.prototype.toString.call(hora) ===
      '[object Date]'
    ) {

      if (isNaN(hora.getTime())) {

        throw new Error(
          'La hora del seguimiento no es válida.'
        );
      }

      horas =
        hora.getHours();

      minutos =
        hora.getMinutes();

    } else {

      const horaTexto =
        String(hora).trim();

      const coincidenciaHora =
        horaTexto.match(
          /^(\d{1,2}):(\d{2})(?::\d{2})?$/
        );

      if (!coincidenciaHora) {

        throw new Error(
          'La hora del seguimiento no es válida.'
        );
      }

      horas =
        Number(
          coincidenciaHora[1]
        );

      minutos =
        Number(
          coincidenciaHora[2]
        );
    }

    /*
    * Validaciones.
    */
    if (
      !Number.isInteger(anio) ||
      !Number.isInteger(mes) ||
      !Number.isInteger(dia) ||
      !Number.isInteger(horas) ||
      !Number.isInteger(minutos)
    ) {

      throw new Error(
        'La fecha y hora del seguimiento no son válidas.'
      );
    }

    if (
      mes < 1 ||
      mes > 12 ||
      dia < 1 ||
      dia > 31 ||
      horas < 0 ||
      horas > 23 ||
      minutos < 0 ||
      minutos > 59
    ) {

      throw new Error(
        'La fecha y hora del seguimiento no son válidas.'
      );
    }

    /*
    * Creamos la fecha usando la zona horaria
    * del proyecto de Apps Script.
    */
    const resultado =
      new Date(
        anio,
        mes - 1,
        dia,
        horas,
        minutos,
        0,
        0
      );

    /*
    * Evitamos que JavaScript normalice
    * fechas imposibles.
    *
    * Ejemplo:
    * 31/02/2026
    */
    if (
      resultado.getFullYear() !== anio ||
      resultado.getMonth() !== mes - 1 ||
      resultado.getDate() !== dia ||
      resultado.getHours() !== horas ||
      resultado.getMinutes() !== minutos
    ) {

      throw new Error(
        'La fecha y hora del seguimiento no son válidas.'
      );
    }

    return resultado;
  },



  /**
   * Genera el título del seguimiento.
   *
   * @param {Object} datos
   * @returns {string}
   */
  _crearTitulo(datos) {

    const tipo =
      String(
        datos.tipoEvento ||
        'Seguimiento'
      ).trim();

    const nombre =
      String(
        datos.nombreCliente ||
        'Cliente'
      ).trim();

    return (
      'Seguimiento - ' +
      tipo +
      ' - ' +
      nombre
    );
  },


  /**
   * Genera la descripción del evento
   * que aparecerá en Google Calendar.
   *
   * @param {Object} datos
   * @returns {string}
   */
  _crearDescripcion(datos) {

    return [

      'Cliente: ' +
        String(
          datos.nombreCliente ||
          ''
        ),

      'ID Cliente: ' +
        String(
          datos.idCliente ||
          ''
        ),

      'Tipo de evento: ' +
        String(
          datos.tipoEvento ||
          ''
        ),

      '',

      'Motivo del seguimiento:',

      String(
        datos.motivoSeguimiento ||
        ''
      ),

      '',

      'Comentario del evento:',

      String(
        datos.comentario ||
        ''
      ),

      '',

      'Resultado:',

      String(
        datos.resultadoEvento ||
        ''
      ),

      '',

      'ID Evento CRM: ' +
        String(
          datos.idEvento ||
          ''
        )

    ].join('\n');
  }

};
