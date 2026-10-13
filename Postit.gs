const Postit = {
  NOMBRE_HOJA: 'POSTITS',
  COLUMNAS: {
    ID_POSTIT: 0,
    ID_CLIENTE: 1,
    FECHA: 2,
    DESCRIPCION: 3,
    ARCHIVADO: 4
  },

  obtenerActivos(offset, limit) {
    offset = offset || 0;
    limit = limit || 5;
    const hoja = Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);
    const valores = hoja.getDataRange().getValues();
    if (valores.length <= 1) {
      return { postits: [], total: 0, offset: offset, limit: limit };
    }
    const filasActivas = valores.slice(1).filter(fila =>
      fila.some(valor => valor !== '') &&
      (fila[this.COLUMNAS.ARCHIVADO] === false || fila[this.COLUMNAS.ARCHIVADO] === 'false')
    );
    filasActivas.sort((a, b) => {
      const fechaA = this._valorFechaOrdenamiento(a[this.COLUMNAS.FECHA]);
      const fechaB = this._valorFechaOrdenamiento(b[this.COLUMNAS.FECHA]);
      return fechaB - fechaA;
    });
    const total = filasActivas.length;
    const filasPaginadas = filasActivas.slice(offset, offset + limit);
    const postits = filasPaginadas.map(fila => this._filaAObjeto(fila));
    return { postits, total, offset, limit };
  },

  obtenerTodos(offset, limit) {
    offset = offset || 0;
    limit = limit || 50;
    const hoja = Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);
    const valores = hoja.getDataRange().getValues();
    if (valores.length <= 1) {
      return { postits: [], total: 0, offset: offset, limit: limit };
    }
    const filas = valores.slice(1).filter(fila => fila.some(valor => valor !== ''));
    filas.sort((a, b) => {
      const fechaA = this._valorFechaOrdenamiento(a[this.COLUMNAS.FECHA]);
      const fechaB = this._valorFechaOrdenamiento(b[this.COLUMNAS.FECHA]);
      return fechaB - fechaA;
    });
    const total = filas.length;
    const filasPaginadas = filas.slice(offset, offset + limit);
    const postits = filasPaginadas.map(fila => this._filaAObjeto(fila));
    return { postits, total, offset, limit };
  },

  obtenerPorId(idPostit) {
    const idBuscado = Utils.texto(idPostit);
    if (!idBuscado) return null;
    const hoja = Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);
    const valores = hoja.getDataRange().getValues();
    if (valores.length <= 1) return null;
    for (let i = 1; i < valores.length; i++) {
      if (valores[i][this.COLUMNAS.ID_POSTIT] === idBuscado) {
        return this._filaAObjeto(valores[i]);
      }
    }
    return null;
  },

  buscar(termino) {
    const terminoBuscado = Utils.texto(termino).toLowerCase();
    if (!terminoBuscado) return [];
    const hoja = Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);
    const valores = hoja.getDataRange().getValues();
    if (valores.length <= 1) return [];
    const resultados = [];
    for (let i = 1; i < valores.length; i++) {
      const fila = valores[i];
      if (fila[this.COLUMNAS.ARCHIVADO] === true || fila[this.COLUMNAS.ARCHIVADO] === 'true') continue;
      const descripcion = String(fila[this.COLUMNAS.DESCRIPCION] || '').toLowerCase();
      if (descripcion.includes(terminoBuscado)) {
        resultados.push(this._filaAObjeto(fila));
      }
    }
    resultados.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    return resultados;
  },

  crear(datos) {
    if (!datos || typeof datos !== 'object') {
      throw new Error('Los datos del Postit son obligatorios.');
    }
    const descripcion = Utils.texto(datos.descripcion || '').trim();
    if (!descripcion) {
      throw new Error('La descripción del Postit es obligatoria.');
    }
    const idCliente = Utils.texto(datos.idCliente || '').trim();
    const idPostit = this._generarId();
    const fecha = new Date();
    const hoja = Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);
    const fila = [idPostit, idCliente, fecha, descripcion, false];
    hoja.appendRow(fila);
    return { idPostit, idCliente, fecha, descripcion, archivado: false };
  },

  actualizar(datos) {
    if (!datos || typeof datos !== 'object') {
      throw new Error('Los datos del Postit son obligatorios.');
    }
    const idPostit = Utils.texto(datos.idPostit || '').trim();
    if (!idPostit) throw new Error('El ID del Postit es obligatorio.');
    const postitExistente = this.obtenerPorId(idPostit);
    if (!postitExistente) throw new Error('Postit no encontrado.');
    const descripcion = datos.descripcion !== undefined
      ? Utils.texto(datos.descripcion || '').trim()
      : postitExistente.descripcion;
    if (!descripcion) throw new Error('La descripción del Postit es obligatoria.');
    const idCliente = datos.idCliente !== undefined
      ? Utils.texto(datos.idCliente || '').trim()
      : postitExistente.idCliente;
    const archivado = datos.archivado !== undefined
      ? datos.archivado === true || datos.archivado === 'true'
      : postitExistente.archivado;
    const fecha = new Date();
    const hoja = Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);
    const valores = hoja.getDataRange().getValues();
    let filaIndex = -1;
    for (let i = 1; i < valores.length; i++) {
      if (valores[i][this.COLUMNAS.ID_POSTIT] === idPostit) {
        filaIndex = i;
        break;
      }
    }
    if (filaIndex === -1) throw new Error('Postit no encontrado en la hoja.');
    hoja.getRange(filaIndex + 1, 1, 1, 5).setValues([[idPostit, idCliente, fecha, descripcion, archivado]]);
    return { idPostit, idCliente, fecha, descripcion, archivado };
  },

  archivar(idPostit) {
    return this.actualizar({ idPostit: idPostit, archivado: true });
  },

  desarchivar(idPostit) {
    return this.actualizar({ idPostit: idPostit, archivado: false });
  },

  eliminar(idPostit) {
    const idBuscado = Utils.texto(idPostit);
    if (!idBuscado) throw new Error('El ID del Postit es obligatorio.');
    const hoja = Spreadsheet.obtenerHoja(this.NOMBRE_HOJA);
    const valores = hoja.getDataRange().getValues();
    for (let i = 1; i < valores.length; i++) {
      if (valores[i][this.COLUMNAS.ID_POSTIT] === idBuscado) {
        hoja.deleteRow(i + 1);
        return;
      }
    }
    throw new Error('Postit no encontrado.');
  },

  _filaAObjeto(fila) {
    return {
      idPostit: String(fila[this.COLUMNAS.ID_POSTIT] || '').trim(),
      idCliente: String(fila[this.COLUMNAS.ID_CLIENTE] || '').trim(),
      fecha: this._valorFecha(fila[this.COLUMNAS.FECHA]),
      descripcion: String(fila[this.COLUMNAS.DESCRIPCION] || '').trim(),
      archivado: fila[this.COLUMNAS.ARCHIVADO] === true || fila[this.COLUMNAS.ARCHIVADO] === 'true'
    };
  },

  _valorFecha(valor) {
    if (valor instanceof Date) return valor;
    if (typeof valor === 'number') return new Date(Math.round(valor * 86400000));
    if (typeof valor === 'string') {
      const fecha = new Date(valor);
      if (!isNaN(fecha.getTime())) return fecha;
    }
    return new Date();
  },

  _valorFechaOrdenamiento(valor) {
    const fecha = this._valorFecha(valor);
    return fecha.getTime();
  },

  _generarId() {
    const prefix = 'POST-';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return prefix + timestamp + '-' + random;
  }
};
