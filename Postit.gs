// ============================================================================
// ARCHIVO: Postit.gs
//
// Backend para el gestor de Notas (Postits).
// ============================================================================

/**
 * Obtiene todas las notas archivadas y no archivadas.
 * 
 * @returns {Array} Array de objetos con las notas.
 */
function apiObtenerNotas() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('POSTITS');
    
    if (!sheet) {
      return {
        success: false,
        error: 'Hoja POSTITS no encontrada. Por favor, crea una hoja con ese nombre.'
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const notas = [];
    
    // Saltar cabecera y filtrar no archivadas
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Columna E (índice 4) = Archivado
      if (row[4] === true) {
        continue;
      }
      
      notas.push({
        idPostit: row[0],
        idCliente: row[1] || '',
        fecha: row[2],
        descripcion: row[3],
        archivado: false
      });
    }
    
    // Ordenar por fecha (más recientes primero)
    notas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    return {
      success: true,
      notas: notas
    };
    
  } catch (e) {
    Logger.log('Error en apiObtenerNotas: ' + e.toString());
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Obtiene todas las notas incluyendo las archivadas.
 * 
 * @returns {Array} Array de objetos con todas las notas.
 */
function apiObtenerTodasLasNotas() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('POSTITS');
    
    if (!sheet) {
      return {
        success: false,
        error: 'Hoja POSTITS no encontrada.'
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const notas = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      notas.push({
        idPostit: row[0],
        idCliente: row[1] || '',
        fecha: row[2],
        descripcion: row[3],
        archivado: row[4] === true
      });
    }
    
    notas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    return {
      success: true,
      notas: notas
    };
    
  } catch (e) {
    Logger.log('Error en apiObtenerTodasLasNotas: ' + e.toString());
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Crea una nueva nota.
 * 
 * @param {Object} datos - Datos de la nota.
 * @param {string} datos.descripcion - Descripción de la nota.
 * @param {string} [datos.idCliente] - ID del cliente (opcional).
 * @returns {Object} Resultado de la operación.
 */
function apiCrearNota(datos) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('POSTITS');
    
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('POSTITS');
      sheet.appendRow(['ID_Postit', 'ID_Cliente', 'Fecha', 'Descripción', 'Archivado']);
    }
    
    // Generar ID único
    const allNotas = apiObtenerTodasLasNotas();
    let nextId = 1;
    
    if (allNotas.success && allNotas.notas.length > 0) {
      const lastId = allNotas.notas[allNotas.notas.length - 1].idPostit;
      const parts = lastId.split('-');
      nextId = parseInt(parts[2]) + 1;
    }
    
    const idPostit = 'POST-' + new Date().getFullYear() + '-' + String(nextId).padStart(4, '0');
    
    // Agregar nueva nota
    sheet.appendRow([
      idPostit,
      datos.idCliente || '',
      new Date(),
      datos.descripcion,
      false
    ]);
    
    return {
      success: true,
      idPostit: idPostit,
      mensaje: 'Nota creada correctamente'
    };
    
  } catch (e) {
    Logger.log('Error en apiCrearNota: ' + e.toString());
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Actualiza una nota existente.
 * 
 * @param {Object} datos - Datos de la nota.
 * @param {string} datos.idPostit - ID de la nota.
 * @param {string} datos.descripcion - Nueva descripción.
 * @returns {Object} Resultado de la operación.
 */
function apiActualizarNota(datos) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('POSTITS');
    
    if (!sheet) {
      return {
        success: false,
        error: 'Hoja POSTITS no encontrada.'
      };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === datos.idPostit) {
        // Actualizar descripción (columna D, índice 3)
        sheet.getRange(i + 1, 4).setValue(datos.descripcion);
        
        return {
          success: true,
          mensaje: 'Nota actualizada correctamente'
        };
      }
    }
    
    return {
      success: false,
      error: 'Nota no encontrada'
    };
    
  } catch (e) {
    Logger.log('Error en apiActualizarNota: ' + e.toString());
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Actualiza una nota con nueva descripción.
 * 
 * @param {Object} params - Parámetros.
 * @param {string} params.idPostit - ID de la nota.
 * @param {string} params.descripcion - Nueva descripción.
 * @returns {Object} Resultado de la operación.
 */
function apiActualizarPostit(params) {
  return apiActualizarNota(params);
}

/**
 * Archiva una nota.
 * 
 * @param {Object} params - Parámetros.
 * @param {string} params.idPostit - ID de la nota.
 * @returns {Object} Resultado de la operación.
 */
function apiArchivarNota(params) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('POSTITS');
    
    if (!sheet) {
      return {
        success: false,
        error: 'Hoja POSTITS no encontrada.'
      };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.idPostit) {
        // Marcar como archivado (columna E, índice 4)
        sheet.getRange(i + 1, 5).setValue(true);
        
        return {
          success: true,
          mensaje: 'Nota archivada correctamente'
        };
      }
    }
    
    return {
      success: false,
      error: 'Nota no encontrada'
    };
    
  } catch (e) {
    Logger.log('Error en apiArchivarNota: ' + e.toString());
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * Elimina una nota permanentemente.
 * 
 * @param {Object} params - Parámetros.
 * @param {string} params.idPostit - ID de la nota.
 * @returns {Object} Resultado de la operación.
 */
function apiEliminarNota(params) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('POSTITS');
    
    if (!sheet) {
      return {
        success: false,
        error: 'Hoja POSTITS no encontrada.'
      };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.idPostit) {
        sheet.deleteRow(i + 1);
        
        return {
          success: true,
          mensaje: 'Nota eliminada correctamente'
        };
      }
    }
    
    return {
      success: false,
      error: 'Nota no encontrada'
    };
    
  } catch (e) {
    Logger.log('Error en apiEliminarNota: ' + e.toString());
    return {
      success: false,
      error: e.toString()
    };
  }
}
