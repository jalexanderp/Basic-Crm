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
    EVENTO_CALENDAR: 13,
    DURACION_MINUTOS: 14
  },

  // Duración por defecto (minutos) para eventos manuales.
  DURACION_DEFECTO: 60,

  // Duración (minutos) para los eventos automáticos rápidos.
  DURACION_RAPIDA: 1,


  /**
   * Crea un evento CRM manual (desde el formulario).
   *
   * Si requiere seguimiento, crea una cita en Calendar con la duración
   * indicada (por defecto 60 minutos) y recordatorio según CONFIGURACION.
   *
   * @param {Object} datos Datos del evento (incluye duracionMinutos opcional).
   * @param {boolean} [permitirCruce] Si es true, crea la cita aunque se
   *   cruce con otro compromiso. Si es false (por defecto) y hay cruce,
   *   se lanza un error con prefijo CONFLICTO_HORARIO:: para que el
   *   frontend ofrezca crearla de todas formas.
   * @returns {Object}
   */
  crear(datos, permitirCruce) {

    this._validarDatos(datos);

    const lock =
      LockService.getScriptLock();

    lock.waitLock(10000);

    let idEventoCalendar = '';

    try {

      const hoja =
        Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

      const cliente =
        Cliente.obtenerPorId(datos.idCliente);

      if (!cliente) {
        throw new Error('El cliente indicado no existe.');
      }

      const idEvento =
        this._generarNuevoId(hoja);

      const ahora = new Date();

      const seguimiento =
        this._texto(datos.requiereSeguimiento);

      const fechaEvento =
        seguimiento === 'Sí'
          ? this._convertirFecha(datos.fechaEvento)
          : '';

      const horaEvento =
        seguimiento === 'Sí'
          ? this._formatearHora(datos.horaEvento)
          : '';

      // Duración: la del formulario o el valor por defecto (60).
      const duracionMinutos =
        this._duracionValida(datos.duracionMinutos, this.DURACION_DEFECTO);

      let fechaNotificacion = '';

      if (seguimiento === 'Sí') {
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

      // CALENDAR: solo se crea una cita cuando requiere seguimiento.
      if (seguimiento === 'Sí') {

        const datosCalendar = {
          idEvento: idEvento,
          idCliente: cliente.idCliente,
          nombreCliente: cliente.nombreCompleto,
          tipoEvento: datos.tipoEvento,
          comentario: datos.comentario,
          resultadoEvento: datos.resultadoEvento,
          motivoSeguimiento: datos.motivoSeguimiento,
          fechaEvento: datos.fechaEvento,
          horaEvento: datos.horaEvento,
          duracionMinutos: duracionMinutos
        };

        const eventoCalendar =
          CalendarTrabajo.crearEvento(
            datosCalendar,
            permitirCruce === true
          );

        idEventoCalendar = eventoCalendar.id;
      }

      const fila = [
        idEvento,
        cliente.idCliente,
        ahora,
        horaRegistro,
        cliente.nombreCompleto,
        this._texto(datos.tipoEvento),
        this._texto(datos.comentario),
        seguimiento,
        fechaEvento,
        horaEvento,
        fechaNotificacion,
        this._texto(datos.resultadoEvento),
        seguimiento === 'Sí' ? this._texto(datos.motivoSeguimiento) : '',
        idEventoCalendar,
        duracionMinutos
      ];

      hoja.appendRow(fila);

      return this._formatearEvento(fila);

    } catch (error) {

      // Si Calendar fue creado pero falló el guardado en Sheets,
      // intentamos revertirlo para no dejar compromisos huérfanos.
      if (idEventoCalendar) {
        try {
          CalendarTrabajo.eliminarEvento(idEventoCalendar);
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
   * Normaliza y valida una duración en minutos.
   *
   * @param {*} valor Valor recibido.
   * @param {number} porDefecto Valor a usar si no es válido.
   * @returns {number}
   */
  _duracionValida(valor, porDefecto) {

    const n = parseInt(valor, 10);

    if (isNaN(n) || n < 1) {
      return porDefecto;
    }

    return n;
  },


  /**
   * Crea un evento automático con duración de 1 minuto y sin recordatorio.
   * Esta función se usa para eventos automáticos que deben ser rápidos.
   *
   * @param {Object} datos
   * @returns {Object}
   */
  crearEventoRapido(datos) {

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

      if (seguimiento === 'Sí') {
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

      let datosCalendar = null;

      if (seguimiento === 'Sí') {

        datosCalendar = {
          idEvento: idEvento,
          idCliente: cliente.idCliente,
          nombreCliente: cliente.nombreCompleto,
          tipoEvento: datos.tipoEvento,
          comentario: datos.comentario,
          resultadoEvento: datos.resultadoEvento,
          motivoSeguimiento: datos.motivoSeguimiento,
          fechaEvento: datos.fechaEvento,
          horaEvento: datos.horaEvento
        };

        const eventoCalendar =
          CalendarTrabajo.crearEventoRapido(
            datosCalendar
          );

        idEventoCalendar =
          eventoCalendar.id;
      }

      const fila = [
        idEvento,
        cliente.idCliente,
        ahora,
        horaRegistro,
        cliente.nombreCompleto,
        this._texto(datos.tipoEvento),
        this._texto(datos.comentario),
        seguimiento,
        fechaEvento,
        horaEvento,
        fechaNotificacion,
        this._texto(datos.resultadoEvento),
        seguimiento === 'Sí' ? this._texto(datos.motivoSeguimiento) : '',
        idEventoCalendar,
        this.DURACION_RAPIDA
      ];

      hoja.appendRow(fila);

      return this._formatearEvento(fila);

    } catch (error) {
      if (idEventoCalendar) {
        try {
          CalendarTrabajo.eliminarEvento(idEventoCalendar);
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
   * Obtiene el PRÓXIMO evento (fecha de evento futura más cercana) para
   * un conjunto de clientes, leyendo la hoja EVENTOS una sola vez.
   *
   * "Próximo" = evento con requiereSeguimiento = 'Sí' cuya fecha de
   * evento es hoy o futura, tomando el más cercano por cliente. Incluye
   * todos los tipos de evento (manuales y automáticos).
   *
   * @param {Array<string>} idsClientes
   * @returns {Object} Mapa { idCliente: eventoProximo }
   */
  obtenerProximosPorClientes(idsClientes) {

    const resultado = {};

    if (!idsClientes || !idsClientes.length) {
      return resultado;
    }

    // Conjunto de IDs buscados para acceso rápido.
    const buscados = {};
    idsClientes.forEach(id => {
      buscados[String(id)] = true;
    });

    const hoja =
      Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

    const datos =
      hoja.getDataRange().getValues();

    if (datos.length <= 1) {
      return resultado;
    }

    // Hoy a medianoche (para comparar solo por día).
    const ahora = new Date();
    const hoy = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate()
    );

    // Guardamos, por cliente, el evento más próximo y su tiempo.
    const mejores = {}; // idCliente -> { tiempo, evento }

    for (let i = 1; i < datos.length; i++) {

      const fila = datos[i];

      const idCliente =
        String(fila[this.COLUMNAS.ID_CLIENTE] || '');

      if (!buscados[idCliente]) {
        continue;
      }

      const seguimiento =
        String(fila[this.COLUMNAS.REQUIERE_SEGUIMIENTO] || '').trim();

      if (seguimiento !== 'Sí') {
        continue;
      }

      const valorFecha = fila[this.COLUMNAS.FECHA_EVENTO];
      const fechaEvento = this._aFechaComparable(valorFecha);

      if (!fechaEvento) {
        continue;
      }

      // Solo eventos de hoy en adelante.
      if (fechaEvento.getTime() < hoy.getTime()) {
        continue;
      }

      const tiempo = fechaEvento.getTime();

      if (
        !mejores[idCliente] ||
        tiempo < mejores[idCliente].tiempo
      ) {
        mejores[idCliente] = {
          tiempo: tiempo,
          evento: this._formatearEvento(fila)
        };
      }
    }

    for (const id in mejores) {
      resultado[id] = mejores[id].evento;
    }

    return resultado;
  },


  /**
   * Analiza los eventos de cada cliente y devuelve, por cliente, dos
   * banderas útiles para calcular su estado:
   *   - desistio: tiene algún evento con resultado "Desiste del negocio"
   *   - tieneSeguimiento: tiene algún evento cuyo resultado NO es
   *     "Desiste del negocio" ni "Cierre de venta"
   *
   * Lee la hoja EVENTOS una sola vez.
   *
   * @param {Array<string>} idsClientes
   * @returns {Object} Mapa { idCliente: { desistio, tieneSeguimiento } }
   */
  analizarEstadoPorClientes(idsClientes) {

    const resultado = {};

    if (!idsClientes || !idsClientes.length) {
      return resultado;
    }

    const buscados = {};
    idsClientes.forEach(id => {
      buscados[String(id)] = true;
    });

    const hoja =
      Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

    const datos =
      hoja.getDataRange().getValues();

    if (datos.length <= 1) {
      return resultado;
    }

    for (let i = 1; i < datos.length; i++) {

      const fila = datos[i];

      const idCliente =
        String(fila[this.COLUMNAS.ID_CLIENTE] || '');

      if (!buscados[idCliente]) {
        continue;
      }

      const resultadoEvento =
        String(fila[this.COLUMNAS.RESULTADO_EVENTO] || '')
          .trim()
          .toLowerCase();

      if (!resultado[idCliente]) {
        resultado[idCliente] = {
          desistio: false,
          tieneSeguimiento: false
        };
      }

      if (resultadoEvento === 'desiste del negocio') {
        resultado[idCliente].desistio = true;
      } else if (resultadoEvento !== 'cierre de venta') {
        // Cualquier otro resultado cuenta como seguimiento en curso.
        resultado[idCliente].tieneSeguimiento = true;
      }
    }

    return resultado;
  },


  /**
   * Convierte un valor de fecha de evento a un Date comparable (a
   * medianoche), aceptando Date, dd/MM/yyyy o yyyy-MM-dd.
   *
   * @param {*} valor
   * @returns {Date|null}
   */
  _aFechaComparable(valor) {

    if (!valor) {
      return null;
    }

    if (Object.prototype.toString.call(valor) === '[object Date]') {
      if (isNaN(valor.getTime())) {
        return null;
      }
      return new Date(
        valor.getFullYear(),
        valor.getMonth(),
        valor.getDate()
      );
    }

    const texto = String(valor).trim();

    // dd/MM/yyyy
    let m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }

    // yyyy-MM-dd
    m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    return null;
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
        ),

      duracionMinutos:
        this._duracionValida(
          fila[this.COLUMNAS.DURACION_MINUTOS],
          this.DURACION_DEFECTO
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
  },

  /**
   * Crea un evento automático de seguimiento inicial.
   *
   * Se crea n días después de la fecha de registro del cliente.
   * Duración: 1 minuto, sin recordatorio.
   *
   * @param {Object} cliente
   */
  crearSeguimientoInicial(cliente) {

    const diasSeguimiento =
      Config.obtenerParametro('Seguimiento Inicial', 10);

    if (!diasSeguimiento || diasSeguimiento <= 0) {
      return;
    }

    // Calcular fecha del evento (a las 7:00 AM)
    const fechaRegistro = this._convertirFecha(cliente.fechaRegistro);
    const fechaEvento = new Date(
      fechaRegistro.getTime() +
      diasSeguimiento * 24 * 60 * 60 * 1000
    );
    fechaEvento.setHours(7, 0, 0, 0);

    const datos = {
      idCliente: cliente.idCliente,
      tipoEvento: 'Seguimiento Inicial',
      comentario: 'Llamada de 5 minutos para verificar si el cliente continúa con interés sobre el negocio.',
      requiereSeguimiento: 'Sí',
      resultadoEvento: 'Pendiente',
      fechaEvento: Utilities.formatDate(
        fechaEvento,
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      ),
      horaEvento: '07:00',
      motivoSeguimiento: 'Seguimiento inicial automático.'
    };

    // Crear el evento rápido (1 minuto, sin recordatorio)
    const evento = this.crearEventoRapido(datos);
  },

  /**
   * Crea un evento automático de cumpleaños.
   *
   * Duración: 1 minuto, sin recordatorio.
   *
   * @param {Object} cliente
   */
  crearEventoCumpleanos(cliente) {

    if (!cliente.fechaNacimiento) {
      return;
    }

    // Obtener el día y mes de nacimiento (ignoramos el año de nacimiento).
    // Extraemos día/mes directamente del texto para evitar cualquier
    // conversión de zona horaria.
    const dm = this._extraerDiaMes(cliente.fechaNacimiento);

    if (!dm) {
      return;
    }

    const mesNacimiento = dm.mes;   // 1-12
    const diaNacimiento = dm.dia;   // 1-31

    // Año actual y día/mes de hoy (números, sin objetos Date).
    const ahora = new Date();
    const anioActual = ahora.getFullYear();
    const mesHoy = ahora.getMonth() + 1;
    const diaHoy = ahora.getDate();

    // Determinar el año del próximo cumpleaños.
    // Si el cumpleaños de este año ya pasó (mes/día anterior a hoy),
    // usamos el próximo año. Si es hoy o futuro, se mantiene este año.
    let anioEvento = anioActual;
    const yaPaso =
      (mesNacimiento < mesHoy) ||
      (mesNacimiento === mesHoy && diaNacimiento < diaHoy);

    if (yaPaso) {
      anioEvento = anioActual + 1;
    }

    // Construimos la fecha del evento como texto YYYY-MM-DD directamente,
    // sin usar objetos Date ni Utilities.formatDate, para que NO haya
    // ningún desfase de zona horaria.
    const fechaEventoTexto =
      anioEvento + '-' +
      String(mesNacimiento).padStart(2, '0') + '-' +
      String(diaNacimiento).padStart(2, '0');

    // Leer la plantilla desde CONFIGURACION, reemplazar variables y
    // generar el link de WhatsApp con el texto correctamente codificado.
    const resultado = Utils.construirMensajeWhatsApp(
      'Mensaje de cumpleaños',
      cliente,
      'Hola {PRIMER_NOMBRE}, ¡feliz cumpleaños! Te deseo un excelente día.'
    );

    const mensajePersonalizado = resultado.mensaje;
    const linkWhatsApp = resultado.linkWhatsApp;

    const datos = {
      idCliente: cliente.idCliente,
      tipoEvento: 'Cumpleaños',
      comentario: mensajePersonalizado + '\n\nEnviar por WhatsApp: ' + linkWhatsApp,
      requiereSeguimiento: 'Sí',
      resultadoEvento: 'Pendiente',
      fechaEvento: fechaEventoTexto,
      horaEvento: '07:00',
      motivoSeguimiento: 'Evento automático de cumpleaños.'
    };

    // Crear el evento rápido (1 minuto, sin recordatorio)
    const evento = this.crearEventoRapido(datos);
  },

  /**
   * Extrae día y mes de una fecha, sin conversiones de zona horaria.
   *
   * Acepta:
   * - Date (usa getDate/getMonth locales)
   * - Cadena YYYY-MM-DD
   * - Cadena DD/MM/YYYY
   *
   * @param {*} valor
   * @returns {{dia: number, mes: number}|null}
   */
  _extraerDiaMes(valor) {

    if (!valor) {
      return null;
    }

    // Si es un objeto Date válido, usamos sus componentes locales.
    if (
      Object.prototype.toString.call(valor) === '[object Date]'
    ) {
      if (isNaN(valor.getTime())) {
        return null;
      }
      return {
        dia: valor.getDate(),
        mes: valor.getMonth() + 1
      };
    }

    const texto = String(valor).trim();

    // Formato YYYY-MM-DD
    let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return {
        mes: Number(m[2]),
        dia: Number(m[3])
      };
    }

    // Formato DD/MM/YYYY
    m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      return {
        dia: Number(m[1]),
        mes: Number(m[2])
      };
    }

    return null;
  },

  /**
   * Actualiza el evento automático de cumpleaños cuando cambia la fecha de nacimiento.
   *
   * @param {Object} cliente
   */
  actualizarEventoCumpleanos(cliente) {

    if (!cliente.fechaNacimiento) {
      return;
    }

    // Obtener evento de cumpleaños existente (si lo hay)
    const eventos =
      this.obtenerPorCliente(cliente.idCliente);

    const eventoCumpleanos = eventos.find(
      evento =>
        evento.tipoEvento === 'Cumpleaños' || evento.tipoEvento === 'Mensaje de cumpleaños'
    );

    // Si ya existe un evento de cumpleaños, lo eliminamos para volver a
    // crearlo con la fecha/mensaje actualizados.
    if (eventoCumpleanos) {
      this.eliminarEventoPorId(eventoCumpleanos.idEvento);
    }

    // Crear (o recrear) el evento de cumpleaños. Esto cubre el caso en
    // que el cliente se creó SIN fecha de nacimiento y luego se le agrega
    // mediante una actualización: aquí se genera el evento por primera vez.
    this.crearEventoCumpleanos(cliente);
  },

  /**
   * Elimina un evento por su ID.
   *
   * @param {string} idEvento
   */
  eliminarEventoPorId(idEvento) {

    if (!idEvento) {
      return;
    }

    const hoja =
      Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

    const ultimaFila =
      hoja.getLastRow();

    if (ultimaFila < 2) {
      return;
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

    for (let i = valores.length - 1; i >= 0; i--) {
      if (String(valores[i][0] || '') === idEvento) {
        hoja.deleteRow(i + 2);
        break;
      }
    }
  },

  /**
   * Crea o actualiza los eventos automáticos de postventa (3/6/12 meses)
   * a partir de la FECHA DE VENTA.
   *
   * Se invoca al registrar o actualizar una venta. Cada evento se agenda
   * a las 7:00 AM del día correspondiente, con duración de 1 minuto y sin
   * recordatorio. Si un evento del mismo tipo ya existe para el cliente,
   * se actualiza en lugar de duplicarse.
   *
   * @param {Object} cliente Cliente asociado a la venta.
   * @param {Date|string} fechaVenta Fecha de la venta (ancla del cálculo).
   */
  actualizarEventosPostventa(cliente, fechaVenta) {

    if (!cliente || !fechaVenta) {
      return;
    }

    const fechaBase = this._convertirFecha(fechaVenta);

    if (!fechaBase) {
      return;
    }

    // Obtener meses desde la configuración
    const meses3 =
      Config.obtenerParametro('Seguimiento postventa 1', 3);
    const meses6 =
      Config.obtenerParametro('Seguimiento postventa 2', 6);
    const meses12 =
      Config.obtenerParametro('Seguimiento postventa 3', 12);

    // Actualizar evento de 3 meses
    this._actualizarOCrearEventoPostventa(
      cliente,
      fechaBase,
      meses3,
      'Seguimiento Postventa 3 Meses',
      'Mensaje seguimiento 3 meses',
      'Hola {PRIMER_NOMBRE}, ¿cómo estás? Quería saber cómo te ha ido con tu vehículo.'
    );

    // Actualizar evento de 6 meses
    this._actualizarOCrearEventoPostventa(
      cliente,
      fechaBase,
      meses6,
      'Seguimiento Postventa 6 Meses',
      'Mensaje seguimiento 6 meses',
      'Hola {PRIMER_NOMBRE}, ¿cómo estás? Ya han pasado varios meses desde que estrenaste tu vehículo.'
    );

    // Actualizar evento de 12 meses
    this._actualizarOCrearEventoPostventa(
      cliente,
      fechaBase,
      meses12,
      'Seguimiento Postventa 12 Meses',
      'Mensaje seguimiento 12 meses',
      'Hola {PRIMER_NOMBRE}, ¿cómo estás? ¡Ya llevamos un año desde que adquiriste tu vehículo!'
    );
  },

  /**
   * Actualiza o crea un evento postventa.
   *
   * @param {Object} cliente
   * @param {Date} fechaRegistro
   * @param {number} meses
   * @param {string} tipoEvento Nombre del tipo de evento (para EVENTOS).
   * @param {string} nombreParametroMensaje Nombre del parámetro en CONFIGURACION.
   * @param {string} mensajePorDefecto Texto a usar si el parámetro no existe.
   */
  _actualizarOCrearEventoPostventa(
    cliente,
    fechaRegistro,
    meses,
    tipoEvento,
    nombreParametroMensaje,
    mensajePorDefecto
  ) {

    if (!meses || meses <= 0) {
      return;
    }

    // Calcular la fecha del evento (a las 7:00 AM) a partir de la fecha
    // de registro más los meses indicados. Formateamos como texto
    // YYYY-MM-DD manualmente para evitar desfases de zona horaria.
    const base = new Date(fechaRegistro.getTime());
    base.setMonth(base.getMonth() + meses);

    const fechaEventoTexto =
      base.getFullYear() + '-' +
      String(base.getMonth() + 1).padStart(2, '0') + '-' +
      String(base.getDate()).padStart(2, '0');

    // Leer la plantilla desde CONFIGURACION, reemplazar variables y
    // generar el link de WhatsApp con el texto correctamente codificado.
    const resultado = Utils.construirMensajeWhatsApp(
      nombreParametroMensaje,
      cliente,
      mensajePorDefecto
    );

    const comentario =
      resultado.mensaje + '\n\nEnviar por WhatsApp: ' + resultado.linkWhatsApp;

    // Verificar si ya existe un evento de este tipo para el cliente.
    const eventos =
      this.obtenerPorCliente(cliente.idCliente);

    const eventoExistente = eventos.find(
      evento => evento.tipoEvento === tipoEvento
    );

    if (eventoExistente) {
      // Actualizar el evento existente.
      this.actualizar({
        idEvento: eventoExistente.idEvento,
        comentario: comentario,
        requiereSeguimiento: 'Sí',
        resultadoEvento: 'Pendiente',
        fechaEvento: fechaEventoTexto,
        horaEvento: '07:00',
        motivoSeguimiento: tipoEvento + ' automático.'
      });
    } else {
      // Crear un evento nuevo (1 minuto, sin recordatorio).
      this.crearEventoRapido({
        idCliente: cliente.idCliente,
        tipoEvento: tipoEvento,
        comentario: comentario,
        requiereSeguimiento: 'Sí',
        resultadoEvento: 'Pendiente',
        fechaEvento: fechaEventoTexto,
        horaEvento: '07:00',
        motivoSeguimiento: tipoEvento + ' automático.'
      });
    }
  },

  /**
   * Actualiza un evento de Calendar para eliminar el recordatorio.
   *
   * @param {string} idEventoCalendar
   */
  _actualizarSinRecordatorio(idEventoCalendar) {

    try {
      const calendario =
        CalendarTrabajo._obtenerCalendario();

      const evento =
        calendario.getEventById(idEventoCalendar);

      if (evento) {
        // Eliminar todos los recordatorios
        evento.removeAllReminders();
      }
    } catch (e) {
      console.error(
        'Error al actualizar recordatorio de Calendar: ' +
        e.message
      );
    }
  },

  /**
   * Actualiza la fecha de un evento existente.
   *
   * @param {string} idEvento
   * @param {Date} fechaNacimiento
   */
  _actualizarFechaEvento(idEvento, fechaNacimiento) {

    if (!idEvento || !fechaNacimiento) {
      return;
    }

    try {
      const eventos =
        this.obtenerPorCliente('');
      const hoja =
        Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);

      const ultimaFila =
        hoja.getLastRow();

      if (ultimaFila < 2) {
        return;
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

      for (let i = 0; i < valores.length; i++) {
        if (
          String(valores[i][0] || '') === idEvento
        ) {
          numeroFila = i + 2;
          break;
        }
      }

      if (numeroFila === -1) {
        return;
      }

      // Calcular nueva fecha (a las 7:00 AM)
      const fechaActual = new Date();
      const fechaNac = this._convertirFecha(fechaNacimiento);
      let fechaCumpleanos = new Date(
        fechaActual.getFullYear(),
        fechaNac.getMonth(),
        fechaNac.getDate()
      );

      // Si ya pasó este año, usar el próximo
      if (fechaCumpleanos < fechaActual) {
        fechaCumpleanos.setFullYear(
          fechaActual.getFullYear() + 1
        );
      }

      const fechaEvento = new Date(fechaCumpleanos);
      fechaEvento.setHours(7, 0, 0, 0);

      hoja
        .getRange(
          numeroFila,
          this.COLUMNAS.FECHA_EVENTO + 1
        )
        .setValue(
          Utilities.formatDate(
            fechaEvento,
            Session.getScriptTimeZone(),
            'yyyy-MM-dd'
          )
        );
    } catch (e) {
      console.error(
        'Error al actualizar fecha de evento: ' +
        e.message
      );
    }
  }

};
