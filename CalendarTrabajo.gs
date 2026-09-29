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
   * ID del calendario "Trabajo".
   *
   * Se utiliza el ID en lugar del nombre para evitar
   * problemas si existen varios calendarios o si
   * posteriormente se cambia el nombre.
   *
   * Para obtener el ID de tu calendario:
   * 1. Ve a Google Calendar
   * 2. En la barra lateral, busca tu calendario "Trabajo"
   * 3. Haz clic en los tres puntos (...) y selecciona "Configurar y compartir"
   * 4. Copia el ID del calendario
   *
   * Si no tienes un calendario específico, puedes usar el calendario predeterminado
   * ejecutando CalendarTrabajo.getCalendarId() desde el editor de Apps Script.
   */
  ID_CALENDARIO: CalendarApp.getDefaultCalendar().getId(),

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
   * Obtiene las horas de anticipación del recordatorio
   * desde la hoja CONFIGURACION.
   *
   * @returns {number}
   */
  obtenerHorasRecordatorio() {
    return Config.obtenerParametro('Horas de anticipación del recordatorio', this.HORAS_RECORDATORIO);
  },


  /**
   * Crea una cita de seguimiento en Calendar.
   *
   * Este método solamente debe llamarse cuando
   * el evento requiere seguimiento.
   *
   * @param {Object} datos Datos del evento (incluye duracionMinutos opcional).
   * @param {boolean} [permitirCruce] Si es true, crea la cita aunque se
   *   cruce con otro evento. Si es false y hay cruce, lanza un error con
   *   prefijo CONFLICTO_HORARIO::
   * @returns {Object}
   */
  crearEvento(datos, permitirCruce) {

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

    // Duración indicada por el usuario (o el valor por defecto).
    const duracionMinutos =
      this._duracionMinutos(datos.duracionMinutos);

    const fechaFin =
      new Date(
        fechaInicio.getTime() +
        duracionMinutos *
        60 *
        1000
      );

    /*
     * Validamos el CRUCE REAL con otros eventos (solapamiento de
     * inicio/fin), SIN holgura. Solo cuando NO se ha autorizado el
     * cruce. Si permitirCruce es true, se omite la validación y la
     * cita puede crearse en paralelo a otras.
     */
    if (permitirCruce !== true) {
      this._validarDisponibilidad(
        calendario,
        fechaInicio,
        fechaFin
      );
    }

    const minutosRecordatorio =
      this.obtenerHorasRecordatorio() * 60;

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
   * Crea un evento rápido de 1 minuto sin recordatorio.
   *
   * Se usa para eventos automáticos que deben ser breves.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  crearEventoRapido(datos) {

    if (!datos || typeof datos !== 'object') {
      throw new Error('Los datos del calendario son obligatorios.');
    }

    const calendario = this._obtenerCalendario();

    const fechaInicio = this._crearFechaHora(
      datos.fechaEvento,
      datos.horaEvento
    );

    const fechaFin = new Date(
      fechaInicio.getTime() +
      1 * 60 * 1000
    );

    /*
     * Los eventos automáticos (cumpleaños, postventa, seguimiento
     * inicial) son recordatorios de 1 minuto a las 7:00 AM. NO son
     * citas reales, por lo que NO validamos disponibilidad ni holgura:
     * pueden coincidir varios el mismo día (p. ej. dos clientes que
     * cumplen años la misma fecha).
     */

    const minutosRecordatorio = 0;

    const titulo = this._crearTitulo(datos);

    const descripcion = this._crearDescripcion(datos);

    const evento = calendario.createEvent(
      titulo,
      fechaInicio,
      fechaFin,
      {
        description: descripcion
      }
    );

    evento.removeAllReminders();

    return {
      id: evento.getId(),
      titulo: titulo,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      minutosRecordatorio: minutosRecordatorio
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

    // Detección de CRUCE REAL: solapamiento del intervalo del evento
    // [fechaInicio, fechaFin) con eventos existentes. SIN holgura.
    const eventos =
      calendario.getEvents(
        fechaInicio,
        fechaFin
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
            inicioExistente < fechaFin &&
            finExistente > fechaInicio
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

    /*
     * Prefijo CONFLICTO_HORARIO:: para que el frontend reconozca que
     * es un cruce de horario (y ofrezca crear el evento en paralelo),
     * en lugar de tratarlo como un error genérico.
     */
    throw new Error(
      'CONFLICTO_HORARIO::' +
      'Ya existe un evento en la misma fecha/hora (' +
      inicio + ' - ' + fin + ').'
    );
  },


  /**
   * Normaliza la duración en minutos (usa DURACION_MINUTOS por defecto).
   *
   * @param {*} valor
   * @returns {number}
   */
  _duracionMinutos(valor) {

    const n = parseInt(valor, 10);

    if (isNaN(n) || n < 1) {
      return this.DURACION_MINUTOS;
    }

    return n;
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
  },

  /**
   * Obtiene el ID del calendario predeterminado.
   * Usa esta función para obtener el ID correcto de tu calendario.
   *
   * @returns {string}
   */
  getCalendarId() {
    const calendar = CalendarApp.getDefaultCalendar();
    return calendar.getId();
  },

  /**
   * Lista los calendarios disponibles.
   * Usa esta función para encontrar el ID de tu calendario "Trabajo".
   *
   * @returns {Array<string>}
   */
  listCalendars() {
    const calendars = CalendarApp.getAllCalendars();
    return calendars.map(cal => ({
      name: cal.getName(),
      id: cal.getId()
    }));
  }

};
