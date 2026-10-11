# CONFIGURACIÓN DEL CALENDARIO TRABAJO

## ¿Qué cambió?

El ID del calendario "Trabajo" ya no está hardcodeado en el código. Ahora se lee desde la hoja CONFIGURACION de tu Google Sheet.

## Cómo configurar

### Paso 1: Obtener el ID de tu calendario

1. Ve a [Google Calendar](https://calendar.google.com)
2. En la barra lateral izquierda, busca tu calendario "Trabajo"
3. Haz clic en los tres puntos (...) junto al nombre
4. Selecciona "Configurar y compartir"
5. Desplázate hacia abajo y copia el "ID de calendario"
   - Es una cadena larga que termina en `@group.calendar.google.com`

### Paso 2: Agregar el parámetro a CONFIGURACION

En tu Google Sheet, ve a la hoja llamada **CONFIGURACION**:

1. En la **fila 1**, columna N (o la siguiente columna disponible), escribe:
   ```
   ID del calendario Trabajo
   ```

2. En la **fila 2**, columna N (misma columna), pega el ID del calendario:
   ```
   tu-id-de-calendario@group.calendar.google.com
   ```

### Paso 3: Verificar

1. Abre la Web App del CRM
2. Intenta crear un evento con seguimiento
3. Si todo está bien, se creará la cita en Google Calendar

## ¿Qué pasa si no configuro el ID?

Si intentas crear un evento con seguimiento y el ID no está configurado, recibirás un mensaje de error claro:

```
El ID del calendario "Trabajo" no está configurado en la hoja CONFIGURACION.
Por favor, agrega un parámetro con el nombre: "ID del calendario Trabajo"
```

## Nota importante

El nombre del parámetro debe ser **exactamente**:
```
ID del calendario Trabajo
```

El sistema ignora mayúsculas/minúsculas y espacios adicionales, pero es mejor usar el nombre exacto.
