// PostitListaUI.js

let offset = 0;
const limit = 5;
let postits = [];
let total = 0;
let loading = false;

function cargarPostits() {
  if (loading) return;
  loading = true;
  document.getElementById("postitsContainer").innerHTML = '<div class="loading">Cargando notas...</div>';
  google.script.run
    .withSuccessHandler(onPostitsCargados)
    .withFailureHandler(onError)
    .apiObtenerPostits(offset, limit);
}

function onPostitsCargados(data) {
  loading = false;
  if (data.error) { alert("Error: " + data.message); return; }
  postits = data.postits || [];
  total = data.total || 0;
  mostrarPostits();
  mostrarPaginacion();
}

function mostrarPostits() {
  const container = document.getElementById("postitsContainer");
  if (postits.length === 0) {
    container.innerHTML = '<div class="no-data">No hay notas. ¡Crea tu primera nota!</div>';
    return;
  }
  let html = '<div class="postits-grid">';
  postits.forEach(p => {
    const fecha = formatearFecha(p.fecha);
    const cliente = p.idCliente ? '<span class="postit-cliente">👤 ' + p.idCliente + '</span>' : '';
    html += '<div class="postit-card">';
    html += '  <div class="postit-header">';
    html += '    <span class="postit-id">' + p.idPostit + '</span>';
    html += '    <div class="postit-actions">';
    html += '      <button class="btn btn-sm btn-primary" onclick="editarPostit(\'' + p.idPostit + '\')">✏️</button>';
    html += '      <button class="btn btn-sm btn-danger" onclick="archivarPostit(\'' + p.idPostit + '\')">📦</button>';
    html += '    </div></div>';
    html += '  <div class="postit-body"><div class="postit-description">' + p.descripcion + '</div></div>';
    html += '  <div class="postit-footer"><span class="postit-date">📅 ' + fecha + '</span>' + cliente + '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function mostrarPaginacion() {
  const pag = document.getElementById("pagination");
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  if (totalPages <= 1) { pag.innerHTML = ''; return; }
  let html = '<button onclick="cambiarPagina(\'prev\')" ' + (offset === 0 ? 'disabled' : '') + '>‹</button>';
  html += '<span>Página ' + currentPage + ' de ' + totalPages + '</span>';
  html += '<button onclick="cambiarPagina(\'next\')" ' + (offset >= total - limit ? 'disabled' : '') + '>›</button>';
  pag.innerHTML = html;
}

function cambiarPagina(dir) {
  if (dir === 'prev' && offset === 0) return;
  if (dir === 'next' && offset >= total - limit) return;
  offset = dir === 'prev' ? offset - limit : offset + limit;
  cargarPostits();
}

function buscarNotas() {
  const termino = document.getElementById("searchInput").value;
  if (termino.trim() === '') { cargarPostits(); return; }
  google.script.run.withSuccessHandler(onBusquedaResultados).withFailureHandler(onError).apiBuscarPostits(termino);
}

function onBusquedaResultados(resultados) {
  postits = resultados || [];
  total = postits.length;
  offset = 0;
  mostrarPostits();
  document.getElementById("pagination").innerHTML = '';
}
function abrirFormulario() {
  const dialog = google.script.showModalDialog().setTitle("Nueva Nota").setHeight(600);
  const html = '<!DOCTYPE html><html><head><base target="_top"><style>body{font-family:Roboto,sans-serif;padding:20px}.form-group{margin-bottom:15px}label{display:block;margin-bottom:5px;font-weight:500}textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;min-height:150px;font-family:inherit}.btn{padding:10px 20px;border:none;border-radius:4px;cursor:pointer;font-size:14px}.btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}.btn-secondary{background:#6c757d;color:#fff}.buttons{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}</style></head><body><h2>Nueva Nota</h2><div class="form-group"><label>Descripción:</label><textarea id="descripcion" placeholder="Escribe tu nota aquí..."></textarea></div><div class="buttons"><button class="btn btn-secondary" onclick="google.script.host.close()">Cancelar</button><button class="btn btn-primary" onclick="guardarNota()">Guardar</button></div><script>function guardarNota(){const d=document.getElementById("descripcion").value.trim();if(!d){alert("La descripción es obligatoria");return}google.script.run.withSuccessHandler(()=>google.script.host.close()).withFailureHandler(e=>alert("Error: "+e)).apiCrearPostit({descripcion:d})}<\/script></body></html>';
  dialog.setContent(html);
}

function editarPostit(id) {
  google.script.run.withSuccessHandler(p => {
    if (!p) { alert("Postit no encontrado"); return; }
    const dialog = google.script.showModalDialog().setTitle("Editar Nota").setHeight(600);
    const html = '<!DOCTYPE html><html><head><base target="_top"><style>body{font-family:Roboto,sans-serif;padding:20px}.form-group{margin-bottom:15px}label{display:block;margin-bottom:5px;font-weight:500}textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;min-height:150px;font-family:inherit}.btn{padding:10px 20px;border:none;border-radius:4px;cursor:pointer;font-size:14px}.btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}.btn-secondary{background:#6c757d;color:#fff}.buttons{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}</style></head><body><h2>Editar Nota</h2><div class="form-group"><label>Descripción:</label><textarea id="descripcion">' + p.descripcion + '</textarea></div><div class="buttons"><button class="btn btn-secondary" onclick="google.script.host.close()">Cancelar</button><button class="btn btn-primary" onclick="actualizarNota(\'' + id + '\')">Guardar</button></div><script>function actualizarNota(id){const d=document.getElementById("descripcion").value.trim();if(!d){alert("La descripción es obligatoria");return}google.script.run.withSuccessHandler(()=>google.script.host.close()).withFailureHandler(e=>alert("Error: "+e)).apiActualizarPostit({idPostit:id,descripcion:d})}<\/script></body></html>';
    dialog.setContent(html);
  }).withFailureHandler(onError).apiObtenerPostit(id);
}

function archivarPostit(id) {
  if (!confirm("¿Quieres archivar esta nota?")) return;
  google.script.run.withSuccessHandler(() => cargarPostits()).withFailureHandler(onError).apiArchivarPostit(id);
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleString("es-ES", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function onError(error) {
  loading = false;
  alert("Error: " + (error.message || error));
}

document.addEventListener("DOMContentLoaded", () => cargarPostits());
