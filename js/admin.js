// js/admin.js - VERSIÓN CORREGIDA (FIX DASHBOARD)

// VARIABLES GLOBALES
let idClienteSeleccionado = null;
let idEjercicioEnEdicion = null;
let idRutinaEnEdicion = null;
let rutinaTemporal = { nombre: "", dias: { 1: [] }, diaSeleccionado: 1 };

// ==========================================
//      1. SEGURIDAD Y NAVEGACIÓN
// ==========================================

async function verificarAdmin() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
    } else {
        cambiarVista('dashboard');
    }
}

document.getElementById('btn-logout').addEventListener('click', async () => {
    const result = await Popup.fire({
        title: '¿Cerrar sesión?', text: "Volverás al inicio.", icon: 'question', confirmButtonText: 'Sí, salir'
    });
    if (result.isConfirmed) {
        await clienteSupabase.auth.signOut();
        window.location.href = 'login.html';
    }
});

function cambiarVista(vista) {
    // 1. Agregamos 'reportes' al array de ocultar
    const secciones = ['dashboard', 'ejercicios', 'rutinas', 'crear-rutina', 'clientes', 'recursos', 'ficha-cliente', 'finanzas', 'reportes'];
    secciones.forEach(s => {
        const el = document.getElementById(`vista-${s}`);
        if(el) el.classList.add('d-none');
    });

    // 2. Agregamos 'reportes' al array de botones
    const botones = ['dashboard', 'ejercicios', 'rutinas', 'clientes', 'recursos', 'finanzas', 'reportes'];
    botones.forEach(b => {
        const btn = document.getElementById(`btn-nav-${b}`);
        if(btn) btn.className = 'nav-link text-white link-opacity-75-hover';
    });

    // 3. Mostrar la seleccionada
    if (vista === 'dashboard') {
        document.getElementById('vista-dashboard').classList.remove('d-none');
        document.getElementById('btn-nav-dashboard').className = 'nav-link active bg-warning text-dark fw-bold';
        cargarDashboard();
    } else if (vista === 'ejercicios') {
        document.getElementById('vista-ejercicios').classList.remove('d-none');
        document.getElementById('btn-nav-ejercicios').className = 'nav-link active bg-warning text-dark fw-bold';
        cargarEjercicios();
    } else if (vista === 'rutinas') {
        document.getElementById('vista-rutinas').classList.remove('d-none');
        document.getElementById('btn-nav-rutinas').className = 'nav-link active bg-warning text-dark fw-bold';
        cargarRutinas();
    } else if (vista === 'crear-rutina') {
        document.getElementById('vista-crear-rutina').classList.remove('d-none');
    } else if (vista === 'clientes') {
        document.getElementById('vista-clientes').classList.remove('d-none');
        document.getElementById('btn-nav-clientes').className = 'nav-link active bg-warning text-dark fw-bold';
        cargarClientes();
    } else if (vista === 'recursos') { 
        document.getElementById('vista-recursos').classList.remove('d-none');
        document.getElementById('btn-nav-recursos').className = 'nav-link active bg-warning text-dark fw-bold';
        cargarRecursos();
    } else if (vista === 'finanzas') { 
        document.getElementById('vista-finanzas').classList.remove('d-none');
        document.getElementById('btn-nav-finanzas').className = 'nav-link active bg-warning text-dark fw-bold';
        cargarModuloFinanzas();
    } else if (vista === 'reportes') { 
        document.getElementById('vista-reportes').classList.remove('d-none');
        document.getElementById('btn-nav-reportes').className = 'nav-link active bg-warning text-dark fw-bold';
        // Inicializar fechas
        const hoy = new Date();
        const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
        const fechaFin = manana.toISOString().split('T')[0];
        document.getElementById('rep-desde').value = primerDia;
        document.getElementById('rep-hasta').value = fechaFin;
        generarReportes();
    }
}


// ==========================================
//      2. DASHBOARD (CORREGIDO)
// ==========================================

async function cargarDashboard() {
    const hoy = new Date();
    document.getElementById('dash-fecha').innerText = hoy.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // 1. INGRESOS DEL MES
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    
    // CORRECCIÓN AQUÍ: Pedimos 'fecha_pago' en vez de 'created_at'
    const { data: pagos, error } = await clienteSupabase
        .from('pagos_historial')
        .select('monto, fecha_pago, perfiles(nombre)') 
        .gte('fecha_pago', primerDiaMes)
        .order('fecha_pago', { ascending: false });

    if(error) console.error("Error Dashboard:", error);

    let totalIngresos = 0;
    let htmlPagos = '';
    
    if (pagos && pagos.length > 0) {
        pagos.forEach((p, index) => {
            totalIngresos += parseFloat(p.monto);
            if (index < 5) { // Top 5 recientes
                // Usamos fecha_pago para mostrar
                const fechaCorta = new Date(p.fecha_pago).toLocaleDateString();
                htmlPagos += `<tr><td class="ps-3 text-secondary small">${fechaCorta}</td><td class="text-white">${p.perfiles.nombre}</td><td class="text-end pe-3 text-success fw-bold">+$${p.monto}</td></tr>`;
            }
        });
    } else {
        htmlPagos = `<tr><td colspan="3" class="text-center text-muted py-5 small">Sin movimientos este mes.</td></tr>`;
    }

    document.getElementById('dash-ingresos').innerText = `$${totalIngresos.toLocaleString()}`;
    document.getElementById('dash-pagos-count').innerText = `${pagos ? pagos.length : 0} pagos este mes`;
    document.getElementById('dash-tabla-pagos').innerHTML = htmlPagos;

    // 2. CLIENTES Y CUMPLEAÑOS
    const { data: clientes } = await clienteSupabase.from('perfiles').select('*').eq('rol', 'cliente');
    let activos = 0;
    let htmlCumples = '';
    const mesActual = hoy.getMonth() + 1; 

    if (clientes) {
        clientes.forEach(c => {
            // Contar Activos
            if (c.fecha_vencimiento_pago) {
                const vence = new Date(c.fecha_vencimiento_pago + 'T00:00:00');
                if (vence >= hoy) activos++;
            }
            // Cumpleaños
            if (c.fecha_nacimiento) {
                const mesCumple = parseInt(c.fecha_nacimiento.split('-')[1]);
                const diaCumple = c.fecha_nacimiento.split('-')[2];
                if (mesCumple === mesActual) {
                    htmlCumples += `<div class="list-group-item bg-transparent border-secondary text-white d-flex align-items-center"><i class="bi bi-cake2-fill text-warning me-3"></i><div><div class="fw-bold">${c.nombre}</div><small class="text-muted">Día ${diaCumple}</small></div></div>`;
                }
            }
        });
    }

    document.getElementById('dash-activos').innerText = activos;
    document.getElementById('dash-total-clientes').innerText = `De ${clientes ? clientes.length : 0} registrados`;
    document.getElementById('lista-cumples').innerHTML = htmlCumples || `<div class="p-5 text-center text-muted small"><i class="bi bi-calendar-x fs-4 d-block mb-2 opacity-50"></i>Nadie cumple años este mes.</div>`;
}


// ==========================================
//      3. GESTIÓN DE EJERCICIOS
// ==========================================

async function cargarEjercicios() {
    const tbody = document.getElementById('tabla-ejercicios');
    let skeletonHTML = '';
    for(let i=0; i<5; i++) skeletonHTML += `<tr><td><div class="skeleton skeleton-avatar"></div></td><td><div class="skeleton skeleton-title mb-0"></div></td><td><div class="skeleton skeleton-btn" style="width: 60px;"></div></td><td class="text-end"><div class="d-flex justify-content-end gap-2"><div class="skeleton skeleton-btn" style="width: 35px;"></div><div class="skeleton skeleton-btn" style="width: 35px;"></div></div></td></tr>`;
    tbody.innerHTML = skeletonHTML;

    await new Promise(r => setTimeout(r, 300)); 

    const { data: ejercicios, error } = await clienteSupabase.from('ejercicios_catalogo').select('*').order('id', { ascending: false });
    if (error) return tbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Error al cargar datos</td></tr>';

    tbody.innerHTML = '';
    ejercicios.forEach(ej => {
        const imgUrl = ej.imagen_url || 'https://placehold.co/50x50/333/FFF?text=?';
        const fila = `<tr class="animate__animated animate__fadeIn"><td><img src="${imgUrl}" class="thumb-ejercicio" alt="img" onerror="this.src='https://placehold.co/50x50/333/FFF?text=Error'"></td><td class="fw-bold text-white">${ej.nombre}</td><td><span class="badge bg-secondary">${ej.grupo_muscular}</span></td><td class="text-end"><button class="btn btn-sm btn-outline-warning me-1" onclick="prepararEdicionEjercicio(${ej.id})"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" onclick="borrarEjercicio(${ej.id})"><i class="bi bi-trash"></i></button></td></tr>`;
        tbody.innerHTML += fila;
    });
}

function limpiarModalEjercicio() {
    idEjercicioEnEdicion = null; 
    document.getElementById('form-nuevo-ejercicio').reset();
    document.getElementById('estado-subida').classList.add('d-none');
}

async function prepararEdicionEjercicio(id) {
    const { data: ejercicio, error } = await clienteSupabase.from('ejercicios_catalogo').select('*').eq('id', id).single();
    if (error) return Toast.fire({icon: 'error', title: 'Error al cargar'});
    document.getElementById('nombreEjercicio').value = ejercicio.nombre;
    document.getElementById('grupoMuscular').value = ejercicio.grupo_muscular;
    document.getElementById('urlImagen').value = ejercicio.imagen_url || "";
    idEjercicioEnEdicion = id;
    new bootstrap.Modal(document.getElementById('modalNuevoEjercicio')).show();
}

async function guardarEjercicio() {
    const nombre = document.getElementById('nombreEjercicio').value;
    const grupo = document.getElementById('grupoMuscular').value;
    const inputArchivo = document.getElementById('archivoImagen');
    let urlFinal = document.getElementById('urlImagen').value; 

    if (!nombre) return Toast.fire({ icon: 'warning', title: 'Falta el nombre' });

    if (inputArchivo.files.length > 0) {
        const archivo = inputArchivo.files[0];
        const estado = document.getElementById('estado-subida');
        estado.classList.remove('d-none');
        const extension = archivo.name.split('.').pop();
        const nombreArchivo = `${Date.now()}_${nombre.replace(/\s+/g, '')}.${extension}`;
        const { error: errorSubida } = await clienteSupabase.storage.from('ejercicios').upload(nombreArchivo, archivo);
        if (errorSubida) {
            Toast.fire({ icon: 'error', title: 'Error subiendo imagen', text: errorSubida.message });
            estado.classList.add('d-none'); return;
        }
        const { data: urlData } = clienteSupabase.storage.from('ejercicios').getPublicUrl(nombreArchivo);
        urlFinal = urlData.publicUrl;
        estado.classList.add('d-none');
    }

    const payload = { nombre: nombre, grupo_muscular: grupo, imagen_url: urlFinal };
    let errorDB;
    if (idEjercicioEnEdicion) errorDB = (await clienteSupabase.from('ejercicios_catalogo').update(payload).eq('id', idEjercicioEnEdicion)).error;
    else errorDB = (await clienteSupabase.from('ejercicios_catalogo').insert([payload])).error;

    if (errorDB) Toast.fire({ icon: 'error', title: 'Error DB', text: errorDB.message });
    else {
        const el = document.getElementById('modalNuevoEjercicio');
        const modal = bootstrap.Modal.getInstance(el); 
        if(modal) modal.hide();
        document.getElementById('form-nuevo-ejercicio').reset();
        cargarEjercicios();
        Toast.fire({ icon: 'success', title: 'Guardado' });
    }
}

async function borrarEjercicio(id) {
    if (!(await Popup.fire({ title: '¿Borrar ejercicio?', icon: 'warning', confirmButtonText: 'Sí, borrar' })).isConfirmed) return;
    const { data: ejercicio } = await clienteSupabase.from('ejercicios_catalogo').select('imagen_url').eq('id', id).single();
    if (ejercicio && ejercicio.imagen_url && ejercicio.imagen_url.includes('supabase')) {
        try { await clienteSupabase.storage.from('ejercicios').remove([ejercicio.imagen_url.split('/').pop()]); } catch (e) { console.error(e); }
    }
    const { error } = await clienteSupabase.from('ejercicios_catalogo').delete().eq('id', id);
    if (error) Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    else { cargarEjercicios(); Toast.fire({ icon: 'success', title: 'Eliminado' }); }
}


// ==========================================
//      4. RUTINAS
// ==========================================

async function cargarRutinas() {
    const tbody = document.getElementById('tabla-rutinas');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border text-warning"></div></td></tr>';
    const { data: rutinas, error } = await clienteSupabase.from('rutinas').select('*').order('id', { ascending: false });
    if (error) return tbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Error al cargar rutinas</td></tr>';
    tbody.innerHTML = '';
    if (rutinas.length === 0) return tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay rutinas creadas.</td></tr>';
    rutinas.forEach(rutina => {
        const fila = `<tr><td class="fw-bold text-white">${rutina.nombre}</td><td><span class="badge bg-info text-dark">Plantilla</span></td><td>${rutina.nivel_dias} días</td><td class="text-end"><button class="btn btn-sm btn-outline-info me-1" onclick="previsualizarRutina(${rutina.id})"><i class="bi bi-eye"></i></button><button class="btn btn-sm btn-outline-warning me-1" onclick="editarRutina(${rutina.id})"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" onclick="borrarRutina(${rutina.id})"><i class="bi bi-trash"></i></button></td></tr>`;
        tbody.innerHTML += fila;
    });
}

async function borrarRutina(id) {
    if (!(await Popup.fire({ title: '¿Eliminar rutina?', icon: 'warning', confirmButtonText: 'Sí, eliminar' })).isConfirmed) return;
    const { error } = await clienteSupabase.from('rutinas').delete().eq('id', id);
    if (error) Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    else { cargarRutinas(); Toast.fire({ icon: 'success', title: 'Eliminada' }); }
}

function abrirConstructor() {
    cambiarVista('crear-rutina');
    document.getElementById('nombreNuevaRutina').value = "";
    document.getElementById('descripcionRutina').value = "";
    rutinaTemporal = { nombre: "", dias: { 1: [] }, diaSeleccionado: 1 };
    idRutinaEnEdicion = null; 
    document.querySelector('#vista-crear-rutina .btn-success').innerHTML = '<i class="bi bi-save me-1"></i> Guardar Rutina';
    renderizarTabs(); cargarCatalogoLateral(); renderizarDiaActual();
}

async function editarRutina(id) {
    cambiarVista('crear-rutina');
    idRutinaEnEdicion = id; 
    const { data: rutina } = await clienteSupabase.from('rutinas').select('*').eq('id', id).single();
    document.getElementById('nombreNuevaRutina').value = rutina.nombre;
    document.getElementById('descripcionRutina').value = rutina.descripcion || "";
    const { data: detalles } = await clienteSupabase.from('rutinas_detalles').select(`*, rutinas_dias!inner ( dia_numero ), ejercicios_catalogo ( nombre )`).eq('rutinas_dias.rutina_id', id).order('orden_ejercicio', { ascending: true });
    rutinaTemporal = { nombre: rutina.nombre, dias: {}, diaSeleccionado: 1 };
    if (detalles && detalles.length > 0) {
        detalles.forEach(d => {
            const numDia = d.rutinas_dias.dia_numero;
            if (!rutinaTemporal.dias[numDia]) rutinaTemporal.dias[numDia] = [];
            if (!rutinaTemporal.dias[numDia].find(item => item._orden_bd === d.orden_ejercicio)) {
                rutinaTemporal.dias[numDia].push({
                    id_temp: Date.now() + Math.random(), ejercicio_id: d.ejercicio_id, nombre: d.ejercicios_catalogo.nombre,
                    tipo: d.tipo_serie, series: d.series_objetivo, reps: d.reps_objetivo, descanso: d.descanso_info, nota: d.observaciones, _orden_bd: d.orden_ejercicio 
                });
            }
        });
    } else rutinaTemporal.dias[1] = [];
    rutinaTemporal.diaSeleccionado = 1; 
    renderizarTabs(); cargarCatalogoLateral(); renderizarDiaActual();
    document.querySelector('#vista-crear-rutina .btn-success').innerHTML = '<i class="bi bi-pencil-square me-1"></i> Actualizar Rutina';
}

async function cargarCatalogoLateral() {
    const { data: ejercicios } = await clienteSupabase.from('ejercicios_catalogo').select('*').order('nombre');
    window.todosLosEjercicios = ejercicios;
    dibujarCatalogo(ejercicios);
}

function dibujarCatalogo(lista) {
    const contenedor = document.getElementById('lista-catalogo-lateral');
    contenedor.innerHTML = "";
    if(!lista) return;
    lista.forEach(ej => {
        const imgUrl = ej.imagen_url || 'https://placehold.co/40x40/333/FFF?text=+';
        contenedor.innerHTML += `<div class="item-catalogo p-2 mb-2 rounded d-flex align-items-center justify-content-between" onclick="agregarEjercicioAlDia(${ej.id})"><div class="d-flex align-items-center"><img src="${imgUrl}" class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;"><div><div class="fw-bold small text-white">${ej.nombre}</div><div class="badge bg-secondary" style="font-size: 0.6rem;">${ej.grupo_muscular}</div></div></div><i class="bi bi-plus-circle text-success fs-5"></i></div>`;
    });
}

function filtrarEjercicios() {
    const texto = document.getElementById('busquedaEjercicio').value.toLowerCase();
    dibujarCatalogo(window.todosLosEjercicios.filter(e => e.nombre.toLowerCase().includes(texto)));
}

function agregarEjercicioAlDia(idEjercicio) {
    const ejercicioOriginal = window.todosLosEjercicios.find(e => e.id == idEjercicio);
    if (!ejercicioOriginal) return;
    const nuevoItem = { id_temp: Date.now(), ejercicio_id: ejercicioOriginal.id, nombre: ejercicioOriginal.nombre, tipo: 'trabajo', series: "3", reps: "10", descanso: "1:30", nota: "" };
    if (!rutinaTemporal.dias[rutinaTemporal.diaSeleccionado]) rutinaTemporal.dias[rutinaTemporal.diaSeleccionado] = [];
    rutinaTemporal.dias[rutinaTemporal.diaSeleccionado].push(nuevoItem);
    renderizarDiaActual();
}

function renderizarDiaActual() {
    const contenedor = document.getElementById('contenedor-rutina-builder');
    const dia = rutinaTemporal.diaSeleccionado;
    const ejerciciosDelDia = rutinaTemporal.dias[dia] || [];
    if (ejerciciosDelDia.length === 0) return contenedor.innerHTML = `<p class="text-muted text-center mt-5"><i class="bi bi-arrow-left-circle fs-1 d-block mb-2"></i>Selecciona ejercicios...</p>`;
    contenedor.innerHTML = "";
    ejerciciosDelDia.forEach((item, index) => {
        const colorBorde = item.tipo === 'calentamiento' ? '#6c757d' : '#ffc107';
        contenedor.innerHTML += `<div class="item-rutina p-3 mb-3 rounded shadow-sm animate__animated animate__fadeIn" style="border-left: 4px solid ${colorBorde}"><div class="d-flex justify-content-between mb-2"><div class="d-flex align-items-center gap-2"><span class="badge bg-dark border border-secondary rounded-circle">${index + 1}</span><h6 class="fw-bold text-white mb-0">${item.nombre}</h6></div><button class="btn btn-sm btn-outline-danger border-0 py-0" onclick="eliminarItem(${item.id_temp})"><i class="bi bi-x-lg"></i></button></div><div class="row g-2"><div class="col-3"><label class="small text-secondary" style="font-size: 0.7rem;">TIPO</label><select class="form-select input-compacto p-1" onchange="actualizarItem(${item.id_temp}, 'tipo', this.value); renderizarDiaActual();"><option value="trabajo" ${item.tipo==='trabajo'?'selected':''}>Trabajo</option><option value="calentamiento" ${item.tipo==='calentamiento'?'selected':''}>Calentamiento</option><option value="fallo" ${item.tipo==='fallo'?'selected':''}>Al Fallo</option></select></div><div class="col-2"><label class="small text-secondary" style="font-size: 0.7rem;">SERIES</label><input type="text" class="form-control input-compacto text-center" value="${item.series}" onchange="actualizarItem(${item.id_temp}, 'series', this.value)"></div><div class="col-2"><label class="small text-secondary" style="font-size: 0.7rem;">REPS</label><input type="text" class="form-control input-compacto text-center" value="${item.reps}" onchange="actualizarItem(${item.id_temp}, 'reps', this.value)"></div><div class="col-5"><label class="small text-secondary" style="font-size: 0.7rem;">NOTA</label><input type="text" class="form-control input-compacto" value="${item.nota}" placeholder="Ej: 75%" onchange="actualizarItem(${item.id_temp}, 'nota', this.value)"></div></div></div>`;
    });
}

function seleccionarDia(numDia) { rutinaTemporal.diaSeleccionado = numDia; renderizarTabs(); renderizarDiaActual(); }
function agregarDia() { const nuevoDia = Object.keys(rutinaTemporal.dias).length + 1; rutinaTemporal.dias[nuevoDia] = []; rutinaTemporal.diaSeleccionado = nuevoDia; renderizarTabs(); renderizarDiaActual(); }
function renderizarTabs() {
    const contenedor = document.getElementById('tabs-dias');
    const totalDias = Object.keys(rutinaTemporal.dias).length;
    contenedor.innerHTML = '';
    for (let i = 1; i <= totalDias; i++) contenedor.innerHTML += `<button type="button" class="btn ${i===rutinaTemporal.diaSeleccionado?'btn-warning fw-bold active':'btn-outline-secondary'}" onclick="seleccionarDia(${i})">Día ${i}</button>`;
    contenedor.innerHTML += `<button type="button" class="btn btn-outline-secondary" onclick="agregarDia()">+ Día</button>`;
    if (totalDias > 1) contenedor.innerHTML += `<button type="button" class="btn btn-outline-danger ms-2" onclick="eliminarDiaActual()"><i class="bi bi-trash"></i></button>`;
}
async function eliminarDiaActual() {
    const diaActual = rutinaTemporal.diaSeleccionado;
    if (Object.keys(rutinaTemporal.dias).length <= 1) return Toast.fire({ icon: 'info', title: 'Mínimo un día' });
    if (!(await Popup.fire({ title: `¿Borrar Día ${diaActual}?`, icon: 'warning' })).isConfirmed) return;
    delete rutinaTemporal.dias[diaActual];
    const nuevosDias = {}; let i = 1;
    for(let key in rutinaTemporal.dias) { nuevosDias[i] = rutinaTemporal.dias[key]; i++; }
    rutinaTemporal.dias = nuevosDias;
    rutinaTemporal.diaSeleccionado = 1; renderizarTabs(); renderizarDiaActual();
}
function actualizarItem(idTemp, campo, valor) { rutinaTemporal.dias[rutinaTemporal.diaSeleccionado].find(i => i.id_temp === idTemp)[campo] = valor; }
function eliminarItem(idTemp) { rutinaTemporal.dias[rutinaTemporal.diaSeleccionado] = rutinaTemporal.dias[rutinaTemporal.diaSeleccionado].filter(i => i.id_temp !== idTemp); renderizarDiaActual(); }

async function guardarRutinaCompleta() {
    const nombre = document.getElementById('nombreNuevaRutina').value;
    const descripcion = document.getElementById('descripcionRutina').value;
    if (!nombre) return Toast.fire({ icon: 'warning', title: 'Falta el nombre' });
    const { data: { user } } = await clienteSupabase.auth.getUser();
    let rutinaId = idRutinaEnEdicion;
    const nivel = Object.keys(rutinaTemporal.dias).length;

    if (rutinaId) {
        await clienteSupabase.from('rutinas').update({ nombre, descripcion, nivel_dias: nivel }).eq('id', rutinaId);
        const { data: dias } = await clienteSupabase.from('rutinas_dias').select('id').eq('rutina_id', rutinaId);
        await clienteSupabase.from('rutinas_detalles').delete().in('dia_id', dias.map(d=>d.id));
        await clienteSupabase.from('rutinas_dias').delete().eq('rutina_id', rutinaId);
    } else {
        const { data: nueva } = await clienteSupabase.from('rutinas').insert([{ nombre, descripcion, es_plantilla: true, creador_id: user.id, nivel_dias: nivel }]).select().single();
        rutinaId = nueva.id;
    }

    for (const numDia of Object.keys(rutinaTemporal.dias)) {
        const { data: dia } = await clienteSupabase.from('rutinas_dias').insert([{ rutina_id: rutinaId, dia_numero: parseInt(numDia), grupo_muscular_objetivo: 'General' }]).select().single();
        let detalles = []; let ejer = 0; let lastId = null; let serie = 1;
        rutinaTemporal.dias[numDia].forEach(item => {
            if(item.ejercicio_id !== lastId) { ejer++; serie=1; lastId=item.ejercicio_id; }
            for(let k=0; k<(parseInt(item.series)||1); k++) {
                detalles.push({ dia_id: dia.id, ejercicio_id: item.ejercicio_id, orden_ejercicio: ejer, orden_serie: serie++, tipo_serie: item.tipo, series_objetivo: item.series, reps_objetivo: item.reps, observaciones: item.nota, descanso_info: 'N/A' });
            }
        });
        await clienteSupabase.from('rutinas_detalles').insert(detalles);
    }
    Swal.fire({ title: '¡Guardado!', icon: 'success', background: '#1e2126', color: '#fff', confirmButtonColor: '#ffc107' });
    abrirConstructor(); cambiarVista('rutinas');
}


// ==========================================
//      5. GESTIÓN DE CLIENTES & FICHA 360°
// ==========================================

async function cargarClientes() {
    const tbody = document.getElementById('tabla-clientes');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5"><div class="spinner-border text-warning"></div></td></tr>';

    const { data: clientes, error } = await clienteSupabase.from('perfiles').select('*').eq('rol', 'cliente').order('nombre');
    if (error) return tbody.innerHTML = '<tr><td colspan="3" class="text-danger text-center">Error al cargar clientes</td></tr>';

    const { data: asignaciones } = await clienteSupabase.from('asignaciones_rutinas').select('cliente_id, rutinas(nombre)').eq('activa', true);

    tbody.innerHTML = '';
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    clientes.forEach(cliente => {
        const asignacion = asignaciones.find(a => a.cliente_id === cliente.id);
        const nombreRutina = asignacion ? asignacion.rutinas.nombre : '<span class="text-muted fst-italic">Sin asignar</span>';
        
        let badgePago = '<span class="badge bg-secondary border border-secondary">Sin Datos</span>';
        if (cliente.fecha_vencimiento_pago) {
            const vencimiento = new Date(cliente.fecha_vencimiento_pago + 'T00:00:00');
            const diferenciaMs = vencimiento - hoy;
            const diasRestantes = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24)); 

            if (diasRestantes > 7) {
                const fechaStr = vencimiento.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                badgePago = `<span class="badge bg-success bg-opacity-25 text-success border border-success">Vence: ${fechaStr}</span>`;
            } else if (diasRestantes >= 0) {
                badgePago = `<span class="badge bg-warning text-dark border border-warning">Vence en ${diasRestantes} días</span>`;
            } else if (diasRestantes >= -7) {
                badgePago = `<span class="badge bg-orange text-white border border-white" style="background-color: #fd7e14;">Gracia (${Math.abs(diasRestantes)} días)</span>`;
            } else {
                badgePago = `<span class="badge bg-danger bg-opacity-25 text-danger border border-danger">VENCIDO</span>`;
            }
        } else {
             badgePago = `<span class="badge bg-danger bg-opacity-25 text-danger border border-danger">Sin Pago</span>`;
        }

        let avatarHTML = cliente.avatar_url 
            ? `<img src="${cliente.avatar_url}" class="rounded-circle border border-secondary me-2" style="width: 35px; height: 35px; object-fit: cover;">`
            : `<div class="rounded-circle bg-secondary d-flex justify-content-center align-items-center me-2 small fw-bold text-white border border-dark" style="width: 35px; height: 35px;">${cliente.nombre.charAt(0).toUpperCase()}</div>`;

        const fila = `
            <tr>
                <td class="text-white">
                    <div class="d-flex align-items-center mb-1">${avatarHTML}<span class="fw-bold">${cliente.nombre}</span></div>
                    <div class="ms-5 ps-1 small">${badgePago}</div>
                </td>
                <td><div class="text-secondary small mb-1">Rutina:</div><div class="text-white small">${nombreRutina}</div></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-light" onclick="abrirFichaCliente('${cliente.id}')" title="Ver Ficha"><i class="bi bi-person-lines-fill"></i></button>
                </td>
            </tr>`;
        tbody.innerHTML += fila;
    });
}

// --- FICHA CLIENTE ---
async function abrirFichaCliente(id) {
    idClienteSeleccionado = id;
    
    // 1. UI: Gestionar Vistas (Ocultar orígenes posibles)
    document.getElementById('vista-clientes').classList.add('d-none');
    document.getElementById('vista-finanzas').classList.add('d-none'); // Importante para volver de finanzas
    document.getElementById('vista-ficha-cliente').classList.remove('d-none');
    
    // 2. Cargar Datos del Perfil
    // 'created_at' viene por defecto en el select('*')
    const { data: perfil } = await clienteSupabase
        .from('perfiles')
        .select('*')
        .eq('id', id)
        .single();
    
    // Header Nombre
    document.getElementById('ficha-nombre').innerText = perfil.nombre;
    
    // --- NUEVO: MOSTRAR FECHA DE ALTA (MIEMBRO DESDE) ---
    if (perfil.created_at) {
        const fechaAlta = new Date(perfil.created_at).toLocaleDateString('es-ES', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        document.getElementById('crm-fecha-alta').innerText = fechaAlta;
    } else {
        document.getElementById('crm-fecha-alta').innerText = "-";
    }
    // ----------------------------------------------------

    // Campos Editables
    document.getElementById('crm-telefono').value = perfil.telefono || '';
    document.getElementById('crm-nacimiento').value = perfil.fecha_nacimiento || '';
    document.getElementById('crm-direccion').value = perfil.direccion || '';
    document.getElementById('crm-emergencia-nombre').value = perfil.contacto_emergencia_nombre || '';
    document.getElementById('crm-emergencia-tel').value = perfil.contacto_emergencia_telefono || '';
    document.getElementById('crm-notas').value = perfil.observaciones_admin || '';

    // Badge de Estado (Arriba a la derecha)
    const divEstado = document.getElementById('ficha-estado');
    if (perfil.fecha_vencimiento_pago) {
        // Podrías agregar lógica de colores aquí si está vencido, por ahora verde simple
        divEstado.className = 'badge bg-success';
        divEstado.innerText = `Vence: ${perfil.fecha_vencimiento_pago}`;
    } else {
        divEstado.className = 'badge bg-danger';
        divEstado.innerText = 'Sin Pago';
    }

    // 3. Cargar Sub-Módulos
    cargarHistorialPagos(id);
    cargarRutinaActualCRM(id);
}

function cerrarFichaCliente() {
    document.getElementById('vista-ficha-cliente').classList.add('d-none');
    
    // Por simplicidad, al volver siempre vamos a la lista de Clientes
    // O podrías volver al Dashboard si prefieres
    document.getElementById('vista-clientes').classList.remove('d-none');
    
    // Nos aseguramos que el menú lateral resalte "Clientes"
    document.getElementById('btn-nav-clientes').click(); 
    
    cargarClientes();
}

async function guardarDatosCRM() {
    const datos = {
        telefono: document.getElementById('crm-telefono').value,
        fecha_nacimiento: document.getElementById('crm-nacimiento').value || null,
        direccion: document.getElementById('crm-direccion').value,
        contacto_emergencia_nombre: document.getElementById('crm-emergencia-nombre').value,
        contacto_emergencia_telefono: document.getElementById('crm-emergencia-tel').value,
        observaciones_admin: document.getElementById('crm-notas').value
    };
    const { error } = await clienteSupabase.from('perfiles').update(datos).eq('id', idClienteSeleccionado);
    if (error) Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    else Toast.fire({ icon: 'success', title: 'Datos guardados' });
}

async function registrarPago() {
    const monto = document.getElementById('fin-monto').value;
    const meses = parseInt(document.getElementById('fin-meses').value);
    const metodo = document.getElementById('fin-metodo').value;

    if (!monto || monto <= 0) return Toast.fire({ icon: 'warning', title: 'Monto inválido' });

    const { data: perfil } = await clienteSupabase.from('perfiles').select('fecha_vencimiento_pago').eq('id', idClienteSeleccionado).single();
    let fechaBase = new Date();
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    if (perfil.fecha_vencimiento_pago) {
        const actual = new Date(perfil.fecha_vencimiento_pago + 'T00:00:00');
        if (actual > hoy) fechaBase = actual;
    }

    const diaOriginal = fechaBase.getDate();
    fechaBase.setMonth(fechaBase.getMonth() + meses);
    if (fechaBase.getDate() !== diaOriginal) fechaBase.setDate(0);
    const fechaSQL = fechaBase.toISOString().split('T')[0];

    const { error: errHist } = await clienteSupabase.from('pagos_historial').insert([{
        cliente_id: idClienteSeleccionado, monto, meses_abonados: meses, metodo_pago: metodo
    }]);
    if (errHist) return Toast.fire({ icon: 'error', title: 'Error historial', text: errHist.message });

    const { error: errPerf } = await clienteSupabase.from('perfiles').update({ fecha_vencimiento_pago: fechaSQL }).eq('id', idClienteSeleccionado);
    if (errPerf) return Toast.fire({ icon: 'error', title: 'Error perfil', text: errPerf.message });

    Toast.fire({ icon: 'success', title: 'Pago registrado', text: `Vence: ${fechaSQL}` });
    document.getElementById('fin-monto').value = ""; 
    cargarHistorialPagos(idClienteSeleccionado);
    document.getElementById('ficha-estado').innerText = `Vence: ${fechaSQL}`;
    document.getElementById('ficha-estado').className = 'badge bg-success';
}

// 1. CARGAR HISTORIAL (CON BOTONES DE ACCIÓN)
async function cargarHistorialPagos(id) {
    const tbody = document.getElementById('tabla-historial-pagos');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">Cargando...</td></tr>';

    const { data: pagos } = await clienteSupabase
        .from('pagos_historial')
        .select('*')
        .eq('cliente_id', id)
        .order('fecha_pago', { ascending: false });
    
    tbody.innerHTML = '';
    
    // Ajustamos la cabecera de la tabla en el HTML dinámicamente si hace falta, 
    // pero idealmente ve a admin.html y agrega <th>Acciones</th> en el thead de esa tabla.
    
    if (!pagos || pagos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center py-3">Sin pagos registrados</td></tr>';
        return;
    }

    pagos.forEach(p => {
        const fecha = new Date(p.fecha_pago).toLocaleDateString();
        const html = `
            <tr>
                <td class="text-secondary align-middle">${fecha}</td>
                <td class="align-middle">
                    ${p.meses_abonados} Mes(es) 
                    <span class="badge bg-dark border border-secondary text-secondary ms-1" style="font-size: 0.65rem;">${p.metodo_pago}</span>
                </td>
                <td class="text-success fw-bold align-middle">$${p.monto}</td>
                <td class="text-end align-middle">
                    <button class="btn btn-sm btn-link text-warning p-0 me-2" onclick="prepararEdicionPago(${p.id})" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="borrarPago(${p.id})" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
        tbody.innerHTML += html;
    });
}

// 2. BORRAR PAGO
async function borrarPago(idPago) {
    const result = await Popup.fire({
        title: '¿Eliminar registro?',
        text: "Esto afectará el balance de caja, pero NO cambiará la fecha de vencimiento del cliente.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        confirmButtonColor: '#d33'
    });

    if (!result.isConfirmed) return;

    const { error } = await clienteSupabase
        .from('pagos_historial')
        .delete()
        .eq('id', idPago);

    if (error) {
        Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    } else {
        Toast.fire({ icon: 'success', title: 'Registro eliminado' });
        // Recargamos la tabla para ver que desapareció
        cargarHistorialPagos(idClienteSeleccionado);
    }
}

// 3. EDITAR PAGO (Abrir Modal)
async function prepararEdicionPago(idPago) {
    // Buscar datos actuales
    const { data: pago, error } = await clienteSupabase
        .from('pagos_historial')
        .select('*')
        .eq('id', idPago)
        .single();

    if (error) return Toast.fire({ icon: 'error', title: 'Error al cargar pago' });

    // Llenar modal
    document.getElementById('idPagoEditar').value = pago.id;
    document.getElementById('edit-monto').value = pago.monto;
    document.getElementById('edit-meses').value = pago.meses_abonados;
    document.getElementById('edit-metodo').value = pago.metodo_pago;

    new bootstrap.Modal(document.getElementById('modalEditarPago')).show();
}

// 4. GUARDAR EDICIÓN
async function guardarEdicionPago() {
    const id = document.getElementById('idPagoEditar').value;
    const monto = document.getElementById('edit-monto').value;
    const meses = document.getElementById('edit-meses').value;
    const metodo = document.getElementById('edit-metodo').value;

    if (!monto || monto <= 0) return Toast.fire({ icon: 'warning', title: 'Monto inválido' });

    const { error } = await clienteSupabase
        .from('pagos_historial')
        .update({
            monto: monto,
            meses_abonados: meses,
            metodo_pago: metodo
        })
        .eq('id', id);

    if (error) {
        Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    } else {
        // Cerrar modal
        const el = document.getElementById('modalEditarPago');
        const modal = bootstrap.Modal.getInstance(el);
        if (modal) modal.hide();

        Toast.fire({ icon: 'success', title: 'Corrección guardada' });
        cargarHistorialPagos(idClienteSeleccionado);
    }
}

async function revocarAcceso() {
    if(!(await Popup.fire({ title: '¿Revocar acceso?', text: "Se bloqueará al cliente.", icon: 'warning', confirmButtonText: 'Sí, bloquear', confirmButtonColor: '#d33' })).isConfirmed) return;
    await clienteSupabase.from('perfiles').update({ fecha_vencimiento_pago: '2020-01-01' }).eq('id', idClienteSeleccionado);
    Toast.fire({ icon: 'success', title: 'Acceso revocado' });
    document.getElementById('ficha-estado').innerText = 'Sin Pago';
    document.getElementById('ficha-estado').className = 'badge bg-danger';
}

// CRM - ENTRENAMIENTO (HERO CARD)

async function cargarRutinaActualCRM(id) {
    const contenedorHero = document.getElementById('contenedor-rutina-hero');
    const tbody = document.getElementById('tabla-historial-rutinas');

    // Validación de seguridad
    if (!contenedorHero || !tbody) return;

    // Estado de Carga
    contenedorHero.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-warning"></div></div>';
    tbody.innerHTML = '';

    const { data: asignaciones, error } = await clienteSupabase
        .from('asignaciones_rutinas')
        .select('created_at, activa, rutinas(nombre, descripcion)')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false });

    // CASO 1: CLIENTE SIN RUTINAS (NUNCA TUVO)
    if (error || !asignaciones || asignaciones.length === 0) {
        contenedorHero.innerHTML = `
            <div class="card bg-dark-subtle border border-secondary border-dashed p-5 text-center rounded-4">
                <i class="bi bi-clipboard-x fs-1 text-secondary mb-3 opacity-50"></i>
                <h4 class="text-white">Sin Rutina Asignada</h4>
                <p class="text-muted small">Este cliente aún no tiene un plan de entrenamiento.</p>
                <button class="btn btn-warning fw-bold mt-2 rounded-pill px-4" onclick="abrirModalAsignarDesdeFicha()">
                    <i class="bi bi-plus-lg me-2"></i>Asignar Primera Rutina
                </button>
            </div>`;
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted small py-4">No hay historial disponible.</td></tr>';
        return;
    }

    // CASO 2: TIENE HISTORIAL
    let hayActiva = false;
    tbody.innerHTML = "";

    asignaciones.forEach(asig => {
        // Formateo de fecha
        const fecha = new Date(asig.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const nombre = asig.rutinas ? asig.rutinas.nombre : '(Rutina Eliminada)';
        const desc = asig.rutinas?.descripcion || "Sin descripción";

        if (asig.activa) {
            hayActiva = true;
            // A. PINTAMOS LA TARJETA HERO (Premium)
            contenedorHero.innerHTML = `
                <div class="card-rutina-hero p-4 text-center">
                    <div class="badge bg-black text-warning border border-warning rounded-pill mb-3 px-3 py-2 small">
                        <i class="bi bi-star-fill me-1"></i> RUTINA ACTIVA
                    </div>
                    <h2 class="text-white fw-bold text-glow mb-1">${nombre}</h2>
                    <p class="text-secondary small mb-4" style="max-width: 400px; margin: 0 auto;">${desc}</p>
                    
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-warning fw-bold rounded-pill px-4 shadow-sm" onclick="abrirModalAsignarDesdeFicha()">
                            <i class="bi bi-arrow-repeat me-2"></i>Cambiar Plan
                        </button>
                    </div>
                </div>`;
            
            // También la agregamos al historial (destacada)
            tbody.innerHTML += `
                <tr class="fila-activa">
                    <td class="text-warning fw-bold ps-4 py-3"><i class="bi bi-caret-right-fill me-2"></i>${fecha}</td>
                    <td class="text-white fw-bold py-3">${nombre}</td>
                    <td class="text-end pe-4 py-3"><span class="badge-status active"><i class="bi bi-check-circle-fill"></i>ACTIVA</span></td>
                </tr>`;
        } else {
            // B. PINTAMOS FILA DE HISTORIAL (Sutil)
            tbody.innerHTML += `
                <tr>
                    <td class="text-secondary ps-4 py-3">${fecha}</td>
                    <td class="text-secondary py-3">${nombre}</td>
                    <td class="text-end pe-4 py-3"><span class="badge-status archived">Archivada</span></td>
                </tr>`;
        }
    });

    // CASO 3: TIENE HISTORIAL PERO NINGUNA ACTIVA (PAUSADO)
    if (!hayActiva) {
        contenedorHero.innerHTML = `
            <div class="card bg-dark border border-danger p-4 text-center rounded-4 shadow-sm">
                <div class="text-danger mb-2"><i class="bi bi-exclamation-circle fs-2"></i></div>
                <h4 class="text-white">Cliente en Pausa</h4>
                <p class="text-muted small">No tiene ninguna rutina activa actualmente.</p>
                <button class="btn btn-outline-danger fw-bold rounded-pill px-4 mt-2" onclick="abrirModalAsignarDesdeFicha()">
                    Reactivar con Rutina
                </button>
            </div>`;
    }
}

function abrirModalAsignarDesdeFicha() {
    const nombre = document.getElementById('ficha-nombre').innerText;
    abrirModalAsignar(idClienteSeleccionado, nombre);
}

// ASIGNACIÓN MODAL
async function abrirModalAsignar(clienteId, nombreCliente) {
    document.getElementById('idClienteAsignar').value = clienteId;
    document.getElementById('nombreClienteAsignar').innerText = nombreCliente;
    const selRutina = document.getElementById('selectRutinaAsignar');
    selRutina.innerHTML = '<option>Cargando...</option>';
    const { data: rutinas } = await clienteSupabase.from('rutinas').select('id, nombre').eq('es_plantilla', true).order('nombre');
    selRutina.innerHTML = '';
    rutinas.forEach(r => selRutina.innerHTML += `<option value="${r.id}">${r.nombre}</option>`);
    
    // Recursos
    const { data: recursos } = await clienteSupabase.from('recursos').select('id, nombre, tipo');
    const selReceta = document.getElementById('selectReceta'); selReceta.innerHTML = '<option value="">-- Ninguna --</option>';
    const selSug = document.getElementById('selectSugerencia'); selSug.innerHTML = '<option value="">-- Ninguno --</option>';
    recursos.forEach(r => {
        if(r.tipo==='receta') selReceta.innerHTML += `<option value="${r.id}">${r.nombre}</option>`;
        else selSug.innerHTML += `<option value="${r.id}">${r.nombre}</option>`;
    });

    new bootstrap.Modal(document.getElementById('modalAsignar')).show();
}

async function guardarAsignacion() {
    const clienteId = document.getElementById('idClienteAsignar').value;
    const rutinaId = document.getElementById('selectRutinaAsignar').value;
    if (!rutinaId) return Toast.fire({ icon: 'warning', title: 'Selecciona una rutina' });
    
    await clienteSupabase.from('asignaciones_rutinas').update({ activa: false }).eq('cliente_id', clienteId);
    await clienteSupabase.from('asignaciones_rutinas').insert([{
        cliente_id: clienteId, rutina_id: rutinaId, activa: true,
        recurso_receta_id: document.getElementById('selectReceta').value || null,
        recurso_sugerencia_id: document.getElementById('selectSugerencia').value || null
    }]);
    
    const el = document.getElementById('modalAsignar');
    const modal = bootstrap.Modal.getInstance(el);
    if(modal) modal.hide();
    
    if(!document.getElementById('vista-ficha-cliente').classList.contains('d-none')) {
        cargarRutinaActualCRM(clienteId);
    } else {
        cargarClientes();
    }
    Toast.fire({ icon: 'success', title: 'Asignado' });
}

// OTROS
async function cargarRecursos() {
    const contenedor = document.getElementById('contenedor-recursos');
    contenedor.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-warning"></div></div>';
    const { data: recursos } = await clienteSupabase.from('recursos').select('*').order('created_at', { ascending: false });
    contenedor.innerHTML = '';
    if (!recursos || recursos.length === 0) return contenedor.innerHTML = '<p class="text-muted text-center col-12">No hay archivos.</p>';
    recursos.forEach(r => {
        const icono = r.tipo === 'receta' ? 'bi-egg-fried text-success' : 'bi-lightbulb text-info';
        const borde = r.tipo === 'receta' ? 'border-success' : 'border-info';
        contenedor.innerHTML += `<div class="col-md-4 mb-3"><div class="card bg-dark-subtle border-start border-4 ${borde} h-100 shadow-sm"><div class="card-body d-flex align-items-center"><i class="bi ${icono} fs-1 me-3"></i><div class="flex-grow-1 overflow-hidden"><h6 class="text-white mb-1 text-truncate">${r.nombre}</h6><a href="${r.archivo_url}" target="_blank" class="small text-warning text-decoration-none">Ver archivo</a></div><button class="btn btn-sm btn-outline-danger ms-2" onclick="borrarRecurso(${r.id})"><i class="bi bi-trash"></i></button></div></div></div>`;
    });
}
function abrirModalRecurso() {
    document.getElementById('form-recurso').reset();
    document.getElementById('status-recurso').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('modalRecurso')).show();
}
async function guardarRecurso() {
    const nombre = document.getElementById('nombreRecurso').value;
    const tipo = document.getElementById('tipoRecurso').value;
    const input = document.getElementById('fileRecurso');
    if (!nombre || input.files.length === 0) return Toast.fire({ icon: 'warning', title: 'Faltan datos' });
    document.getElementById('status-recurso').classList.remove('d-none');
    try {
        const archivo = input.files[0];
        const ext = archivo.name.split('.').pop();
        const path = `${tipo}_${Date.now()}.${ext}`;
        await clienteSupabase.storage.from('materiales').upload(path, archivo);
        const { data: urlData } = clienteSupabase.storage.from('materiales').getPublicUrl(path);
        await clienteSupabase.from('recursos').insert([{ nombre: nombre, tipo: tipo, archivo_url: urlData.publicUrl }]);
        const el = document.getElementById('modalRecurso');
        const modal = bootstrap.Modal.getInstance(el);
        if (modal) modal.hide();
        cargarRecursos();
        Toast.fire({ icon: 'success', title: 'Recurso subido' });
    } catch (error) { Toast.fire({ icon: 'error', title: 'Error', text: error.message }); }
    finally { document.getElementById('status-recurso').classList.add('d-none'); }
}
async function borrarRecurso(id) {
    if(!(await Popup.fire({ title: '¿Borrar?', icon: 'warning', confirmButtonText: 'Sí' })).isConfirmed) return;
    await clienteSupabase.from('recursos').delete().eq('id', id);
    cargarRecursos();
    Toast.fire({ icon: 'success', title: 'Eliminado' });
}
function toggleMenu() {
    document.querySelector('.sidebar').classList.toggle('active');
    document.body.classList.toggle('menu-open');
}
async function previsualizarRutina(id) {
    const modal = new bootstrap.Modal(document.getElementById('modalPrevisualizar'));
    modal.show();
    document.getElementById('contenido-preview').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    const { data: detalles } = await clienteSupabase.from('rutinas_detalles').select(`*, rutinas_dias!inner ( dia_numero, rutinas ( nombre, descripcion ) ), ejercicios_catalogo ( nombre, imagen_url )`).eq('rutinas_dias.rutina_id', id).order('orden_ejercicio', { ascending: true }).order('orden_serie', { ascending: true });
    if (!detalles || detalles.length === 0) return document.getElementById('contenido-preview').innerHTML = '<p class="text-center text-danger">Vacía.</p>';
    document.getElementById('tituloPreview').innerText = detalles[0].rutinas_dias.rutinas.nombre;
    let datosPreview = {}; 
    detalles.forEach(d => { const numDia = d.rutinas_dias.dia_numero; if (!datosPreview[numDia]) datosPreview[numDia] = []; datosPreview[numDia].push(d); });
    const contenedorTabs = document.getElementById('tabs-dias-preview');
    contenedorTabs.innerHTML = '';
    Object.keys(datosPreview).sort().forEach((dia, index) => {
        const btn = document.createElement('button');
        btn.className = index === 0 ? 'btn btn-warning fw-bold btn-sm' : 'btn btn-outline-secondary btn-sm';
        btn.innerText = `Día ${dia}`;
        btn.onclick = () => { Array.from(contenedorTabs.children).forEach(b => b.className = 'btn btn-outline-secondary btn-sm'); btn.className = 'btn btn-warning fw-bold btn-sm'; renderizarDiaPreview(datosPreview[dia]); };
        contenedorTabs.appendChild(btn);
    });
    renderizarDiaPreview(datosPreview[Object.keys(datosPreview)[0]]);
}
function renderizarDiaPreview(ejercicios) {
    const contenedor = document.getElementById('contenido-preview');
    contenedor.innerHTML = '';
    let tarjetaActualIdx = null;
    let html = '';
    ejercicios.forEach(fila => {
        if (fila.orden_ejercicio !== tarjetaActualIdx) {
            if (tarjetaActualIdx !== null) html += `</div></div>`; 
            tarjetaActualIdx = fila.orden_ejercicio;
            const img = fila.ejercicios_catalogo.imagen_url ? `<div class="text-center mb-3"><img src="${fila.ejercicios_catalogo.imagen_url}" class="img-fluid rounded" style="max-height: 150px;"></div>` : '';
            html += `<div class="card-preview p-3 animate__animated animate__fadeIn"><div class="d-flex justify-content-between align-items-center mb-2"><h5 class="m-0 text-white">${fila.ejercicios_catalogo.nombre}</h5><span class="badge-preview">#${fila.orden_ejercicio}</span></div>${img}<div class="lista-series">`;
        }
        html += `<div class="fila-serie-preview row align-items-center text-white"><div class="col-6"><span class="badge ${fila.tipo_serie === 'calentamiento' ? 'bg-secondary' : 'bg-success'} mb-1">${fila.tipo_serie}</span><div class="fw-bold">${fila.reps_objetivo} <span class="text-muted fw-normal">reps</span></div></div><div class="col-6 text-end"><span class="text-muted small">${fila.descanso_info || ''}</span></div></div>`;
    });
    if (ejercicios.length > 0) html += `</div></div>`;
    contenedor.innerHTML = html;
}

// ==========================================
//      7. MÓDULO FINANZAS (CAJA GENERAL)
// ==========================================

// EN js/admin.js

async function cargarModuloFinanzas() {
    const tbody = document.getElementById('tabla-caja');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-warning"></div> Cargando...</td></tr>';

    // 1. Obtener Fechas
    let fechaDesde = document.getElementById('filtro-fecha-desde').value;
    let fechaHasta = document.getElementById('filtro-fecha-hasta').value;
    const hoy = new Date();
    document.getElementById('finanzas-fecha-hoy').innerText = hoy.toLocaleDateString();

    if (!fechaDesde) {
        const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fechaDesde = primerDia.toISOString().split('T')[0];
        document.getElementById('filtro-fecha-desde').value = fechaDesde;
    }
    if (!fechaHasta) {
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);
        fechaHasta = manana.toISOString().split('T')[0];
        document.getElementById('filtro-fecha-hasta').value = fechaHasta;
    }

    // 2. Traer Datos
    const { data: extras } = await clienteSupabase.from('movimientos_caja').select('*').gte('fecha_movimiento', fechaDesde).lte('fecha_movimiento', fechaHasta);
    const { data: cuotas } = await clienteSupabase.from('pagos_historial').select('*, perfiles(nombre)').gte('fecha_pago', fechaDesde).lte('fecha_pago', fechaHasta);

    // 3. Unificar
    let listaUnificada = [];

    if (extras) {
        extras.forEach(m => {
            listaUnificada.push({
                fecha: new Date(m.fecha_movimiento),
                detalle: m.descripcion || '-',
                categoria: m.categoria,
                monto: parseFloat(m.monto),
                tipo: m.tipo,
                metodo: m.metodo_pago,
                es_cuota: false,
                id_origen: m.id
            });
        });
    }

    if (cuotas) {
        cuotas.forEach(c => {
            listaUnificada.push({
                fecha: new Date(c.fecha_pago),
                detalle: `Cuota ${c.perfiles.nombre}`,
                categoria: 'Suscripción',
                monto: parseFloat(c.monto),
                tipo: 'ingreso',
                metodo: c.metodo_pago,
                es_cuota: true,
                id_origen: c.id,
                id_cliente: c.cliente_id // <--- CLAVE: Guardamos el ID del cliente
            });
        });
    }

    listaUnificada.sort((a, b) => b.fecha - a.fecha);

    // 4. Totales y Render
    let totalIngresos = 0, totalEgresos = 0;
    tbody.innerHTML = '';

    if (listaUnificada.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No hay movimientos en estas fechas.</td></tr>';
    } else {
        listaUnificada.forEach(item => {
            if (item.tipo === 'ingreso') totalIngresos += item.monto;
            else totalEgresos += item.monto;

            const colorMonto = item.tipo === 'egreso' ? 'text-danger' : 'text-success';
            const signo = item.tipo === 'egreso' ? '-' : '+';
            
            let iconCat = '';
            if (item.es_cuota) iconCat = '<span class="badge bg-primary bg-opacity-25 text-primary border border-primary"><i class="bi bi-person-check me-1"></i>Cuota</span>';
            else if (item.tipo === 'egreso') iconCat = '<span class="badge bg-danger bg-opacity-25 text-danger border border-danger"><i class="bi bi-arrow-down"></i> Gasto</span>';
            else iconCat = '<span class="badge bg-success bg-opacity-25 text-success border border-success"><i class="bi bi-arrow-up"></i> Extra</span>';

            // --- LÓGICA DEL BOTÓN DE ACCIÓN ---
            let btnAccion = '';
            if (item.es_cuota) {
                // AQUÍ ESTÁ EL CAMBIO: Botón funcional para ir al cliente
                btnAccion = `
                    <button class="btn btn-sm btn-link text-info text-decoration-none p-0" onclick="abrirFichaCliente('${item.id_cliente}')">
                        <i class="bi bi-box-arrow-up-right me-1"></i>Ver Cliente
                    </button>`;
            } else {
                btnAccion = `<button class="btn btn-sm text-danger" onclick="borrarMovimientoCaja(${item.id_origen})"><i class="bi bi-trash"></i></button>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td class="ps-3 text-secondary" style="font-size: 0.85rem;">
                        ${item.fecha.toLocaleDateString()} <br> 
                        <span class="text-muted" style="font-size: 0.7rem;">${item.fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td class="text-white">
                        ${item.detalle} <br> 
                        <span class="badge bg-dark border border-secondary text-secondary" style="font-size:0.6rem">${item.metodo}</span>
                    </td>
                    <td>${iconCat} <span class="small ms-1 text-secondary">${item.categoria}</span></td>
                    <td class="text-end pe-3 fw-bold ${colorMonto}">${signo}$${item.monto.toLocaleString()}</td>
                    <td class="text-end pe-3">${btnAccion}</td>
                </tr>`;
        });
    }

    document.getElementById('box-total-ingresos').innerText = `$${totalIngresos.toLocaleString()}`;
    document.getElementById('box-total-egresos').innerText = `$${totalEgresos.toLocaleString()}`;
    const balance = totalIngresos - totalEgresos;
    const elBalance = document.getElementById('box-balance');
    elBalance.innerText = `$${balance.toLocaleString()}`;
    elBalance.className = balance >= 0 ? 'text-success fw-bold m-0' : 'text-danger fw-bold m-0';
}

async function guardarMovimientoCaja() {
    const tipo = document.querySelector('input[name="tipoMov"]:checked').value;
    const categoria = document.getElementById('caja-categoria').value;
    const desc = document.getElementById('caja-desc').value;
    const monto = document.getElementById('caja-monto').value;
    const metodo = document.getElementById('caja-metodo').value;

    if (!monto || monto <= 0) return Toast.fire({ icon: 'warning', title: 'Monto incorrecto' });
    if (!desc) return Toast.fire({ icon: 'warning', title: 'Falta descripción' });

    const { error } = await clienteSupabase.from('movimientos_caja').insert([{
        tipo: tipo,
        categoria: categoria,
        descripcion: desc,
        monto: monto,
        metodo_pago: metodo
    }]);

    if (error) {
        Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    } else {
        Toast.fire({ icon: 'success', title: 'Registrado' });
        // Limpiar form
        document.getElementById('caja-desc').value = "";
        document.getElementById('caja-monto').value = "";
        cargarModuloFinanzas(); // Recargar para ver el nuevo balance
    }
}

async function borrarMovimientoCaja(id) {
    if(!(await Popup.fire({ title: '¿Borrar movimiento?', icon: 'warning', confirmButtonText: 'Sí, borrar' })).isConfirmed) return;
    
    const { error } = await clienteSupabase.from('movimientos_caja').delete().eq('id', id);
    
    if (error) Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    else {
        Toast.fire({ icon: 'success', title: 'Eliminado' });
        cargarModuloFinanzas();
    }
}

// ==========================================
//      8. MÓDULO REPORTES (BI)
// ==========================================

let chartClientesInstance = null;
let chartFinanzasInstance = null;

async function generarReportes() {
    const fechaDesde = document.getElementById('rep-desde').value;
    const fechaHasta = document.getElementById('rep-hasta').value;
    
    document.getElementById('rango-fechas-txt').innerText = `Del ${new Date(fechaDesde).toLocaleDateString()} al ${new Date(fechaHasta).toLocaleDateString()}`;

    // --- A. ANÁLISIS DE CLIENTES (Snapshot Actual) ---
    const { data: clientes } = await clienteSupabase.from('perfiles').select('fecha_vencimiento_pago').eq('rol', 'cliente');
    
    let activos = 0, porVencer = 0, vencidos = 0;
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    if (clientes) {
        clientes.forEach(c => {
            if (c.fecha_vencimiento_pago) {
                const vence = new Date(c.fecha_vencimiento_pago + 'T00:00:00');
                const diff = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
                
                if (diff > 7) activos++;
                else if (diff >= 0) porVencer++; // Entre 0 y 7 días
                else vencidos++; // Negativo (Vencido)
            } else {
                vencidos++; // Nunca pagó
            }
        });
    }

    // Actualizar KPIs Clientes
    document.getElementById('kpi-activos').innerText = activos;
    document.getElementById('kpi-vencer').innerText = porVencer;
    document.getElementById('kpi-morosos').innerText = vencidos;

    // Renderizar Gráfico Torta
    renderChartClientes(activos, porVencer, vencidos);


    // --- B. ANÁLISIS FINANCIERO (Por Fechas) ---
    // 1. Ingresos por Cuotas
    const { data: cuotas } = await clienteSupabase
        .from('pagos_historial')
        .select('monto')
        .gte('fecha_pago', fechaDesde)
        .lte('fecha_pago', fechaHasta);

    // 2. Caja (Ingresos Extra y Egresos)
    const { data: caja } = await clienteSupabase
        .from('movimientos_caja')
        .select('monto, tipo')
        .gte('fecha_movimiento', fechaDesde)
        .lte('fecha_movimiento', fechaHasta);

    let totalCuotas = 0;
    if (cuotas) cuotas.forEach(c => totalCuotas += parseFloat(c.monto));

    let totalExtras = 0;
    let totalGastos = 0;
    if (caja) {
        caja.forEach(m => {
            if (m.tipo === 'ingreso') totalExtras += parseFloat(m.monto);
            else totalGastos += parseFloat(m.monto);
        });
    }

    const totalIngresos = totalCuotas + totalExtras;
    const balance = totalIngresos - totalGastos;

    // Actualizar KPIs Financieros
    document.getElementById('kpi-ingresos').innerText = `$${totalIngresos.toLocaleString()}`;
    document.getElementById('kpi-egresos').innerText = `$${totalGastos.toLocaleString()}`;
    
    const elBal = document.getElementById('kpi-balance');
    elBal.innerText = `$${balance.toLocaleString()}`;
    elBal.className = balance >= 0 ? 'text-white fw-bold my-2' : 'text-danger fw-bold my-2';

    // Renderizar Gráfico Barras
    renderChartFinanzas(totalCuotas, totalExtras, totalGastos);
}

// --- RENDERS DE GRÁFICOS (CHART.JS) ---

function renderChartClientes(activos, warning, danger) {
    const ctx = document.getElementById('chart-clientes').getContext('2d');
    if (chartClientesInstance) chartClientesInstance.destroy(); // Limpiar anterior

    chartClientesInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Activos', 'Por Vencer', 'Vencidos'],
            datasets: [{
                data: [activos, warning, danger],
                backgroundColor: ['#198754', '#ffc107', '#dc3545'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '70%'
        }
    });
}

function renderChartFinanzas(cuotas, extras, gastos) {
    const ctx = document.getElementById('chart-finanzas').getContext('2d');
    if (chartFinanzasInstance) chartFinanzasInstance.destroy();

    chartFinanzasInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Cuotas', 'Extras', 'Gastos'],
            datasets: [{
                label: 'Monto ($)',
                data: [cuotas, extras, gastos],
                backgroundColor: ['#0d6efd', '#198754', '#dc3545'],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#333' }, ticks: { color: '#aaa' } },
                x: { grid: { display: false }, ticks: { color: '#fff' } }
            }
        }
    });
}

// INICIO
document.addEventListener('DOMContentLoaded', () => {
    verificarAdmin();
});