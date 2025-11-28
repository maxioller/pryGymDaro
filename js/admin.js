// js/admin.js - VERSIÓN FINAL OPTIMIZADA Y COMPLETA

// ==========================================
//      1. SEGURIDAD Y NAVEGACIÓN
// ==========================================

async function verificarAdmin() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
    } else {
        cargarEjercicios(); // Carga inicial por defecto
    }
}

document.getElementById('btn-logout').addEventListener('click', async () => {
    const result = await Popup.fire({
        title: '¿Cerrar sesión?',
        text: "Volverás a la pantalla de ingreso.",
        icon: 'question',
        confirmButtonText: 'Sí, salir'
    });

    if (result.isConfirmed) {
        await clienteSupabase.auth.signOut();
        window.location.href = 'login.html';
    }
});

// Cambio de Vistas (Tabs)
function cambiarVista(vista) {
    // 1. Ocultar TODAS las secciones
    const secciones = ['ejercicios', 'rutinas', 'crear-rutina', 'clientes', 'recursos'];
    secciones.forEach(s => document.getElementById(`vista-${s}`).classList.add('d-none'));

    // 2. Resetear estilos menú
    const botones = ['ejercicios', 'rutinas', 'clientes', 'recursos'];
    botones.forEach(b => {
        const btn = document.getElementById(`btn-nav-${b}`);
        if(btn) btn.className = 'nav-link text-white link-opacity-75-hover';
    });

    // 3. Mostrar selección y activar botón
    if (vista === 'ejercicios') {
        document.getElementById('vista-ejercicios').classList.remove('d-none');
        document.getElementById('btn-nav-ejercicios').className = 'nav-link active bg-warning text-dark fw-bold';
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
    }
}


// ==========================================
//      2. GESTIÓN DE EJERCICIOS (CRUD + SKELETON)
// ==========================================

let idEjercicioEnEdicion = null; 

async function cargarEjercicios() {
    const tbody = document.getElementById('tabla-ejercicios');
    
    // 1. SKELETON ROWS (Efecto de carga visual)
    let skeletonHTML = '';
    for(let i=0; i<5; i++) {
        skeletonHTML += `
            <tr>
                <td><div class="skeleton skeleton-avatar"></div></td>
                <td><div class="skeleton skeleton-title mb-0"></div></td>
                <td><div class="skeleton skeleton-btn" style="width: 60px;"></div></td>
                <td class="text-end"><div class="d-flex justify-content-end gap-2"><div class="skeleton skeleton-btn" style="width: 35px;"></div><div class="skeleton skeleton-btn" style="width: 35px;"></div></div></td>
            </tr>`;
    }
    tbody.innerHTML = skeletonHTML;

    // Pequeño delay artificial para apreciar la animación (UX)
    await new Promise(r => setTimeout(r, 300)); 

    const { data: ejercicios, error } = await clienteSupabase
        .from('ejercicios_catalogo')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Error al cargar datos</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    ejercicios.forEach(ej => {
        const imgUrl = ej.imagen_url || 'https://placehold.co/50x50/333/FFF?text=?';
        const fila = `
            <tr class="animate__animated animate__fadeIn">
                <td>
                    <img src="${imgUrl}" class="thumb-ejercicio" alt="img" onerror="this.src='https://placehold.co/50x50/333/FFF?text=Error'">
                </td>
                <td class="fw-bold text-white">${ej.nombre}</td>
                <td><span class="badge bg-secondary">${ej.grupo_muscular}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="prepararEdicionEjercicio(${ej.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarEjercicio(${ej.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
        tbody.innerHTML += fila;
    });
}

function limpiarModalEjercicio() {
    idEjercicioEnEdicion = null; 
    document.getElementById('form-nuevo-ejercicio').reset();
    document.getElementById('estado-subida').classList.add('d-none');
}

async function prepararEdicionEjercicio(id) {
    const { data: ejercicio, error } = await clienteSupabase
        .from('ejercicios_catalogo')
        .select('*')
        .eq('id', id)
        .single();

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

    // Lógica de subida de imagen
    if (inputArchivo.files.length > 0) {
        const archivo = inputArchivo.files[0];
        const estado = document.getElementById('estado-subida');
        estado.classList.remove('d-none');
        
        const extension = archivo.name.split('.').pop();
        const nombreArchivo = `${Date.now()}_${nombre.replace(/\s+/g, '')}.${extension}`;

        const { error: errorSubida } = await clienteSupabase.storage.from('ejercicios').upload(nombreArchivo, archivo);
        if (errorSubida) {
            Toast.fire({ icon: 'error', title: 'Error subiendo imagen', text: errorSubida.message });
            estado.classList.add('d-none');
            return;
        }

        const { data: urlData } = clienteSupabase.storage.from('ejercicios').getPublicUrl(nombreArchivo);
        urlFinal = urlData.publicUrl;
        estado.classList.add('d-none');
    }

    const payload = { nombre: nombre, grupo_muscular: grupo, imagen_url: urlFinal };
    let errorDB;

    if (idEjercicioEnEdicion) {
        const { error } = await clienteSupabase.from('ejercicios_catalogo').update(payload).eq('id', idEjercicioEnEdicion);
        errorDB = error;
    } else {
        const { error } = await clienteSupabase.from('ejercicios_catalogo').insert([payload]);
        errorDB = error;
    }

    if (errorDB) {
        Toast.fire({ icon: 'error', title: 'Error DB', text: errorDB.message });
    } else {
        const el = document.getElementById('modalNuevoEjercicio');
        const modal = bootstrap.Modal.getInstance(el); 
        if(modal) modal.hide();
        
        document.getElementById('form-nuevo-ejercicio').reset();
        cargarEjercicios();
        Toast.fire({ icon: 'success', title: idEjercicioEnEdicion ? 'Ejercicio actualizado' : 'Ejercicio creado' });
    }
}

async function borrarEjercicio(id) {
    const result = await Popup.fire({
        title: '¿Borrar ejercicio?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        confirmButtonText: 'Sí, borrar'
    });

    if (!result.isConfirmed) return;

    // Intentamos borrar la imagen del storage si existe
    const { data: ejercicio } = await clienteSupabase.from('ejercicios_catalogo').select('imagen_url').eq('id', id).single();
    if (ejercicio && ejercicio.imagen_url && ejercicio.imagen_url.includes('supabase')) {
        try {
            const nombreArchivo = ejercicio.imagen_url.split('/').pop();
            await clienteSupabase.storage.from('ejercicios').remove([nombreArchivo]);
        } catch (e) { console.error(e); }
    }

    const { error } = await clienteSupabase.from('ejercicios_catalogo').delete().eq('id', id);

    if (error) Toast.fire({ icon: 'error', title: 'Error al borrar', text: error.message });
    else {
        cargarEjercicios();
        Toast.fire({ icon: 'success', title: 'Ejercicio eliminado' });
    }
}


// ==========================================
//      3. GESTIÓN DE RUTINAS
// ==========================================

async function cargarRutinas() {
    const tbody = document.getElementById('tabla-rutinas');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border text-warning"></div></td></tr>';

    const { data: rutinas, error } = await clienteSupabase.from('rutinas').select('*').order('id', { ascending: false });

    if (error) return tbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Error al cargar rutinas</td></tr>';

    tbody.innerHTML = '';
    if (rutinas.length === 0) return tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay rutinas creadas.</td></tr>';

    rutinas.forEach(rutina => {
        const etiquetaTipo = '<span class="badge bg-info text-dark">Plantilla</span>';
        const fila = `
            <tr>
                <td class="fw-bold text-white">${rutina.nombre}</td>
                <td>${etiquetaTipo}</td>
                <td>${rutina.nivel_dias} días</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-info me-1" onclick="previsualizarRutina(${rutina.id})" title="Ver como cliente"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="editarRutina(${rutina.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarRutina(${rutina.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        tbody.innerHTML += fila;
    });
}

async function borrarRutina(id) {
    const result = await Popup.fire({
        title: '¿Eliminar rutina?',
        text: "Se borrará también de los clientes que la tengan asignada.",
        icon: 'warning',
        confirmButtonText: 'Sí, eliminar'
    });

    if (!result.isConfirmed) return;

    const { error } = await clienteSupabase.from('rutinas').delete().eq('id', id);
    if (error) Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    else {
        cargarRutinas(); 
        Toast.fire({ icon: 'success', title: 'Rutina eliminada' });
    }
}


// ==========================================
//      4. CONSTRUCTOR DE RUTINAS (LÓGICA PRINCIPAL)
// ==========================================

let rutinaTemporal = { nombre: "", dias: { 1: [] }, diaSeleccionado: 1 };
let idRutinaEnEdicion = null; 

function abrirConstructor() {
    cambiarVista('crear-rutina');
    document.getElementById('nombreNuevaRutina').value = "";
    document.getElementById('descripcionRutina').value = "";
    rutinaTemporal = { nombre: "", dias: { 1: [] }, diaSeleccionado: 1 };
    idRutinaEnEdicion = null; 
    document.querySelector('#vista-crear-rutina .btn-success').innerHTML = '<i class="bi bi-save me-1"></i> Guardar Rutina';
    renderizarTabs(); 
    cargarCatalogoLateral();
    renderizarDiaActual();
}

async function editarRutina(id) {
    cambiarVista('crear-rutina');
    idRutinaEnEdicion = id; 
    const btnGuardar = document.querySelector('#vista-crear-rutina .btn-success');
    btnGuardar.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Cargando...';
    btnGuardar.disabled = true;

    const { data: rutina, error: errorHeader } = await clienteSupabase.from('rutinas').select('*').eq('id', id).single();
    if (errorHeader) {
        Toast.fire({ icon: 'error', title: 'Error', text: 'No se encontró la rutina' });
        cambiarVista('rutinas');
        return;
    }

    document.getElementById('nombreNuevaRutina').value = rutina.nombre;
    document.getElementById('descripcionRutina').value = rutina.descripcion || "";

    const { data: detalles } = await clienteSupabase
        .from('rutinas_detalles')
        .select(`*, rutinas_dias!inner ( dia_numero ), ejercicios_catalogo ( nombre )`)
        .eq('rutinas_dias.rutina_id', id)
        .order('orden_ejercicio', { ascending: true });

    rutinaTemporal = { nombre: rutina.nombre, dias: {}, diaSeleccionado: 1 };

    if (detalles && detalles.length > 0) {
        detalles.forEach(d => {
            const numDia = d.rutinas_dias.dia_numero;
            if (!rutinaTemporal.dias[numDia]) rutinaTemporal.dias[numDia] = [];

            const existe = rutinaTemporal.dias[numDia].find(item => item._orden_bd === d.orden_ejercicio);
            
            if (!existe) {
                rutinaTemporal.dias[numDia].push({
                    id_temp: Date.now() + Math.random(),
                    ejercicio_id: d.ejercicio_id,
                    nombre: d.ejercicios_catalogo.nombre,
                    tipo: d.tipo_serie,
                    series: d.series_objetivo, 
                    reps: d.reps_objetivo,
                    descanso: d.descanso_info,
                    nota: d.observaciones,
                    _orden_bd: d.orden_ejercicio 
                });
            }
        });
    } else {
        rutinaTemporal.dias[1] = [];
    }
        
    rutinaTemporal.diaSeleccionado = 1; 
    renderizarTabs(); 
    cargarCatalogoLateral();
    renderizarDiaActual();
    
    btnGuardar.innerHTML = '<i class="bi bi-pencil-square me-1"></i> Actualizar Rutina';
    btnGuardar.disabled = false;
}

// Helpers Constructor
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
        const html = `
            <div class="item-catalogo p-2 mb-2 rounded d-flex align-items-center justify-content-between" onclick="agregarEjercicioAlDia(${ej.id})">
                <div class="d-flex align-items-center">
                    <img src="${imgUrl}" class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">
                    <div>
                        <div class="fw-bold small text-white">${ej.nombre}</div>
                        <div class="badge bg-secondary" style="font-size: 0.6rem;">${ej.grupo_muscular}</div>
                    </div>
                </div>
                <i class="bi bi-plus-circle text-success fs-5"></i>
            </div>`;
        contenedor.innerHTML += html;
    });
}

function filtrarEjercicios() {
    const texto = document.getElementById('busquedaEjercicio').value.toLowerCase();
    const filtrados = window.todosLosEjercicios.filter(e => e.nombre.toLowerCase().includes(texto));
    dibujarCatalogo(filtrados);
}

function agregarEjercicioAlDia(idEjercicio) {
    const ejercicioOriginal = window.todosLosEjercicios.find(e => e.id == idEjercicio);
    if (!ejercicioOriginal) return;

    const nuevoItem = {
        id_temp: Date.now(),
        ejercicio_id: ejercicioOriginal.id,
        nombre: ejercicioOriginal.nombre,
        tipo: 'trabajo',
        series: "3",
        reps: "10",
        descanso: "1:30",
        nota: ""
    };

    if (!rutinaTemporal.dias[rutinaTemporal.diaSeleccionado]) rutinaTemporal.dias[rutinaTemporal.diaSeleccionado] = [];
    rutinaTemporal.dias[rutinaTemporal.diaSeleccionado].push(nuevoItem);
    renderizarDiaActual();
}

function renderizarDiaActual() {
    const contenedor = document.getElementById('contenedor-rutina-builder');
    const dia = rutinaTemporal.diaSeleccionado;
    const ejerciciosDelDia = rutinaTemporal.dias[dia] || [];

    if (ejerciciosDelDia.length === 0) {
        contenedor.innerHTML = `<p class="text-muted text-center mt-5"><i class="bi bi-arrow-left-circle fs-1 d-block mb-2"></i>Selecciona ejercicios del menú izquierdo para agregarlos al Día ${dia}</p>`;
        return;
    }

    contenedor.innerHTML = "";
    ejerciciosDelDia.forEach((item, index) => {
        const selTrabajo = item.tipo === 'trabajo' ? 'selected' : '';
        const selCalentamiento = item.tipo === 'calentamiento' ? 'selected' : '';
        const selFallo = item.tipo === 'fallo' ? 'selected' : '';
        const colorBorde = item.tipo === 'calentamiento' ? '#6c757d' : '#ffc107';

        const html = `
            <div class="item-rutina p-3 mb-3 rounded shadow-sm animate__animated animate__fadeIn" style="border-left: 4px solid ${colorBorde}">
                <div class="d-flex justify-content-between mb-2">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-dark border border-secondary rounded-circle">${index + 1}</span>
                        <h6 class="fw-bold text-white mb-0">${item.nombre}</h6>
                    </div>
                    <button class="btn btn-sm btn-outline-danger border-0 py-0" onclick="eliminarItem(${item.id_temp})"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="row g-2">
                    <div class="col-3">
                        <label class="small text-secondary" style="font-size: 0.7rem;">TIPO</label>
                        <select class="form-select input-compacto p-1" onchange="actualizarItem(${item.id_temp}, 'tipo', this.value); renderizarDiaActual();">
                            <option value="trabajo" ${selTrabajo}>Trabajo</option>
                            <option value="calentamiento" ${selCalentamiento}>Calentamiento</option>
                            <option value="fallo" ${selFallo}>Al Fallo</option>
                        </select>
                    </div>
                    <div class="col-2">
                        <label class="small text-secondary" style="font-size: 0.7rem;">SERIES</label>
                        <input type="text" class="form-control input-compacto text-center" value="${item.series}" onchange="actualizarItem(${item.id_temp}, 'series', this.value)">
                    </div>
                    <div class="col-2">
                        <label class="small text-secondary" style="font-size: 0.7rem;">REPS</label>
                        <input type="text" class="form-control input-compacto text-center" value="${item.reps}" onchange="actualizarItem(${item.id_temp}, 'reps', this.value)">
                    </div>
                    <div class="col-5">
                        <label class="small text-secondary" style="font-size: 0.7rem;">NOTA</label>
                        <input type="text" class="form-control input-compacto" value="${item.nota}" placeholder="Ej: 75%" onchange="actualizarItem(${item.id_temp}, 'nota', this.value)">
                    </div>
                </div>
            </div>`;
        contenedor.innerHTML += html;
    });
}

function seleccionarDia(numDia) {
    rutinaTemporal.diaSeleccionado = numDia;
    renderizarTabs();
    renderizarDiaActual();
}

function agregarDia() {
    const nuevoDia = Object.keys(rutinaTemporal.dias).length + 1;
    rutinaTemporal.dias[nuevoDia] = [];
    rutinaTemporal.diaSeleccionado = nuevoDia;
    renderizarTabs();
    renderizarDiaActual();
}

function renderizarTabs() {
    const contenedor = document.getElementById('tabs-dias');
    const totalDias = Object.keys(rutinaTemporal.dias).length;
    const diaActual = rutinaTemporal.diaSeleccionado;
    contenedor.innerHTML = '';
    for (let i = 1; i <= totalDias; i++) {
        const isActive = i === diaActual;
        const clase = isActive ? 'btn-warning fw-bold active' : 'btn-outline-secondary';
        contenedor.innerHTML += `<button type="button" class="btn ${clase}" onclick="seleccionarDia(${i})">Día ${i}</button>`;
    }
    contenedor.innerHTML += `<button type="button" class="btn btn-outline-secondary" onclick="agregarDia()">+ Día</button>`;
    if (totalDias > 1) {
        contenedor.innerHTML += `<button type="button" class="btn btn-outline-danger ms-2" onclick="eliminarDiaActual()"><i class="bi bi-trash"></i></button>`;
    }
}

async function eliminarDiaActual() {
    const diaActual = rutinaTemporal.diaSeleccionado;
    const totalDias = Object.keys(rutinaTemporal.dias).length;
    if (totalDias <= 1) return Toast.fire({ icon: 'info', title: 'Mínimo un día requerido' });
    
    const result = await Popup.fire({ title: `¿Borrar Día ${diaActual}?`, icon: 'warning' });
    if (!result.isConfirmed) return;

    const nuevosDias = {};
    let contador = 1;
    for (let i = 1; i <= totalDias; i++) {
        if (i !== diaActual) {
            nuevosDias[contador] = rutinaTemporal.dias[i];
            contador++;
        }
    }
    rutinaTemporal.dias = nuevosDias;
    if (diaActual > Object.keys(nuevosDias).length) rutinaTemporal.diaSeleccionado = diaActual - 1;
    renderizarTabs();
    renderizarDiaActual();
}

function actualizarItem(idTemp, campo, valor) {
    const dia = rutinaTemporal.diaSeleccionado;
    const item = rutinaTemporal.dias[dia].find(i => i.id_temp === idTemp);
    if (item) item[campo] = valor;
}

function eliminarItem(idTemp) {
    const dia = rutinaTemporal.diaSeleccionado;
    rutinaTemporal.dias[dia] = rutinaTemporal.dias[dia].filter(i => i.id_temp !== idTemp);
    renderizarDiaActual();
}

async function guardarRutinaCompleta() {
    const nombre = document.getElementById('nombreNuevaRutina').value;
    const descripcion = document.getElementById('descripcionRutina').value;

    if (!nombre) return Toast.fire({ icon: 'warning', title: 'Falta el nombre' });
    const diasConEjercicios = Object.values(rutinaTemporal.dias).some(lista => lista.length > 0);
    if (!diasConEjercicios) return Toast.fire({ icon: 'warning', title: 'Rutina vacía' });

    const btnGuardar = document.querySelector('#vista-crear-rutina .btn-success');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Guardando...';
    btnGuardar.disabled = true;

    try {
        const { data: { user } } = await clienteSupabase.auth.getUser();
        let rutinaId = idRutinaEnEdicion; 

        if (rutinaId) {
            await clienteSupabase.from('rutinas').update({ 
                    nombre: nombre, 
                    descripcion: descripcion,
                    nivel_dias: Object.keys(rutinaTemporal.dias).length 
                }).eq('id', rutinaId);

            const { data: diasViejos } = await clienteSupabase.from('rutinas_dias').select('id').eq('rutina_id', rutinaId);
            if (diasViejos.length > 0) {
                const ids = diasViejos.map(d => d.id);
                await clienteSupabase.from('rutinas_detalles').delete().in('dia_id', ids);
                await clienteSupabase.from('rutinas_dias').delete().eq('rutina_id', rutinaId);
            }
        } else {
            const { data: nueva, error } = await clienteSupabase.from('rutinas').insert([{
                    nombre: nombre, descripcion: descripcion, es_plantilla: true,
                    creador_id: user.id, nivel_dias: Object.keys(rutinaTemporal.dias).length
                }]).select().single();
            if(error) throw error;
            rutinaId = nueva.id;
        }

        for (const numDia of Object.keys(rutinaTemporal.dias)) {
            const ejerciciosDelDia = rutinaTemporal.dias[numDia];
            if (ejerciciosDelDia.length === 0) continue;

            const { data: diaCreado, error: errorDia } = await clienteSupabase
                .from('rutinas_dias')
                .insert([{ rutina_id: rutinaId, dia_numero: parseInt(numDia), grupo_muscular_objetivo: 'General' }])
                .select().single();
            if (errorDia) throw errorDia;
            
            let filasParaInsertar = [];
            let contadorEjercicio = 0, ultimoEjercicioId = null, contadorSerie = 1;

            ejerciciosDelDia.forEach((item) => {
                if (item.ejercicio_id !== ultimoEjercicioId) {
                    contadorEjercicio++; contadorSerie = 1; ultimoEjercicioId = item.ejercicio_id;
                } 
                const cantidadSeries = parseInt(item.series) || 1;
                for (let i = 0; i < cantidadSeries; i++) {
                    filasParaInsertar.push({
                        dia_id: diaCreado.id,
                        ejercicio_id: item.ejercicio_id,
                        orden_ejercicio: contadorEjercicio, 
                        orden_serie: contadorSerie, 
                        tipo_serie: item.tipo, series_objetivo: item.series, reps_objetivo: item.reps,
                        observaciones: item.nota, descanso_info: 'N/A' 
                    });
                    contadorSerie++; 
                }
            });
            const { error: errorDetalles } = await clienteSupabase.from('rutinas_detalles').insert(filasParaInsertar);
            if (errorDetalles) throw errorDetalles;
        }

        Swal.fire({
            title: '¡Excelente!', text: rutinaId ? 'Rutina actualizada.' : 'Rutina creada.',
            icon: 'success', background: '#1e2126', color: '#fff', confirmButtonColor: '#ffc107', confirmButtonText: 'Genial'
        });
        abrirConstructor(); cambiarVista('rutinas');

    } catch (error) {
        console.error("Error:", error);
        Toast.fire({ icon: 'error', title: 'Error al guardar', text: error.message });
    } finally {
        btnGuardar.disabled = false; btnGuardar.innerHTML = textoOriginal;
    }
}

// ==========================================
//      5. CLIENTES & ASIGNACIÓN (CON AVATAR)
// ==========================================

async function cargarClientes() {
    const tbody = document.getElementById('tabla-clientes');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5"><div class="spinner-border text-warning"></div></td></tr>';

    const { data: clientes, error } = await clienteSupabase.from('perfiles').select('*').eq('rol', 'cliente');
    if (error) return tbody.innerHTML = '<tr><td colspan="3" class="text-danger text-center">Error al cargar clientes</td></tr>';

    const { data: asignaciones } = await clienteSupabase.from('asignaciones_rutinas').select('cliente_id, rutinas(nombre)').eq('activa', true);

    tbody.innerHTML = '';
    clientes.forEach(cliente => {
        const asignacion = asignaciones.find(a => a.cliente_id === cliente.id);
        const nombreRutina = asignacion ? asignacion.rutinas.nombre : '<span class="text-muted fst-italic">Sin asignar</span>';
        const badge = asignacion ? '<span class="badge bg-success">Activa</span>' : '<span class="badge bg-secondary">Inactiva</span>';

        // LÓGICA DE AVATAR (Foto o Inicial)
        let avatarHTML = '';
        if (cliente.avatar_url) {
            avatarHTML = `<img src="${cliente.avatar_url}" class="rounded-circle border border-secondary me-2" style="width: 35px; height: 35px; object-fit: cover;">`;
        } else {
            const inicial = cliente.nombre ? cliente.nombre.charAt(0).toUpperCase() : '?';
            avatarHTML = `<div class="rounded-circle bg-secondary d-flex justify-content-center align-items-center me-2 small fw-bold text-white border border-dark" style="width: 35px; height: 35px;">${inicial}</div>`;
        }

        const fila = `
            <tr>
                <td class="fw-bold text-white">
                    <div class="d-flex align-items-center">
                        ${avatarHTML}
                        ${cliente.nombre}
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center justify-content-between" style="max-width: 250px;">
                        <span class="text-truncate me-2">${nombreRutina}</span>
                        ${badge}
                    </div>
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-warning fw-bold" onclick="abrirModalAsignar('${cliente.id}', '${cliente.nombre}')">Asignar</button>
                </td>
            </tr>`;
        tbody.innerHTML += fila;
    });
}

async function abrirModalAsignar(clienteId, nombreCliente) {
    document.getElementById('idClienteAsignar').value = clienteId;
    document.getElementById('nombreClienteAsignar').innerText = nombreCliente;

    const selRutina = document.getElementById('selectRutinaAsignar');
    const selReceta = document.getElementById('selectReceta');
    const selSugerencia = document.getElementById('selectSugerencia');

    selRutina.innerHTML = '<option>Cargando...</option>';
    selReceta.innerHTML = '<option>Cargando...</option>';
    selSugerencia.innerHTML = '<option>Cargando...</option>';

    const { data: rutinas } = await clienteSupabase.from('rutinas').select('id, nombre').eq('es_plantilla', true).order('nombre');
    selRutina.innerHTML = '';
    if (!rutinas || rutinas.length === 0) selRutina.innerHTML = '<option value="">-- Sin plantillas --</option>';
    else rutinas.forEach(r => selRutina.innerHTML += `<option value="${r.id}">${r.nombre}</option>`);

    const { data: recursos } = await clienteSupabase.from('recursos').select('id, nombre, tipo');
    selReceta.innerHTML = '<option value="">-- Ninguna --</option>';
    selSugerencia.innerHTML = '<option value="">-- Ninguno --</option>';
    if (recursos) {
        recursos.forEach(r => {
            if (r.tipo === 'receta') selReceta.innerHTML += `<option value="${r.id}">${r.nombre}</option>`;
            else if (r.tipo === 'sugerencia') selSugerencia.innerHTML += `<option value="${r.id}">${r.nombre}</option>`;
        });
    }

    new bootstrap.Modal(document.getElementById('modalAsignar')).show();
}

async function guardarAsignacion() {
    const clienteId = document.getElementById('idClienteAsignar').value;
    const rutinaId = document.getElementById('selectRutinaAsignar').value;
    const recetaId = document.getElementById('selectReceta').value || null;
    const sugerenciaId = document.getElementById('selectSugerencia').value || null;

    if (!rutinaId) return Toast.fire({ icon: 'warning', title: 'Selecciona una rutina' });

    await clienteSupabase.from('asignaciones_rutinas').update({ activa: false }).eq('cliente_id', clienteId);
    const { error } = await clienteSupabase.from('asignaciones_rutinas').insert([{
        cliente_id: clienteId, rutina_id: rutinaId, activa: true,
        recurso_receta_id: recetaId, recurso_sugerencia_id: sugerenciaId
    }]);

    if (error) Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    else {
        const el = document.getElementById('modalAsignar');
        const modal = bootstrap.Modal.getInstance(el);
        if(modal) modal.hide();
        cargarClientes();
        Swal.fire({ icon: 'success', title: '¡Asignación guardada!', background: '#1e2126', color: '#fff', confirmButtonColor: '#ffc107', confirmButtonText: 'OK' });
    }
}


// ==========================================
//      6. PREVISUALIZACIÓN & RECURSOS
// ==========================================

async function previsualizarRutina(id) {
    const modal = new bootstrap.Modal(document.getElementById('modalPrevisualizar'));
    modal.show();
    document.getElementById('contenido-preview').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    
    const { data: detalles, error } = await clienteSupabase
        .from('rutinas_detalles')
        .select(`*, rutinas_dias!inner ( dia_numero, rutinas ( nombre, descripcion ) ), ejercicios_catalogo ( nombre, imagen_url )`)
        .eq('rutinas_dias.rutina_id', id)
        .order('orden_ejercicio', { ascending: true })
        .order('orden_serie', { ascending: true });

    if (error || detalles.length === 0) return document.getElementById('contenido-preview').innerHTML = '<p class="text-center text-danger">Rutina vacía.</p>';

    const infoRutina = detalles[0].rutinas_dias.rutinas;
    document.getElementById('tituloPreview').innerText = infoRutina.nombre;
    document.getElementById('descPreview').innerText = infoRutina.descripcion || "Sin descripción";

    let datosPreview = {}; 
    detalles.forEach(d => {
        const numDia = d.rutinas_dias.dia_numero;
        if (!datosPreview[numDia]) datosPreview[numDia] = [];
        datosPreview[numDia].push(d);
    });

    const contenedorTabs = document.getElementById('tabs-dias-preview');
    contenedorTabs.innerHTML = '';
    const diasDisponibles = Object.keys(datosPreview).sort();

    diasDisponibles.forEach((dia, index) => {
        const btn = document.createElement('button');
        const clase = index === 0 ? 'btn-warning fw-bold' : 'btn-outline-secondary'; 
        btn.className = `btn ${clase} btn-sm`;
        btn.innerText = `Día ${dia}`;
        btn.onclick = () => {
             Array.from(contenedorTabs.children).forEach(b => b.className = 'btn btn-outline-secondary btn-sm');
             btn.className = 'btn btn-warning fw-bold btn-sm';
             renderizarDiaPreview(datosPreview[dia]);
        };
        contenedorTabs.appendChild(btn);
    });
    renderizarDiaPreview(datosPreview[diasDisponibles[0]]);
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
            const img = fila.ejercicios_catalogo.imagen_url 
                ? `<div class="text-center mb-3"><img src="${fila.ejercicios_catalogo.imagen_url}" class="img-fluid rounded" style="max-height: 150px;"></div>` : '';

            html += `
                <div class="card-preview p-3 animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="m-0 text-white">${fila.ejercicios_catalogo.nombre}</h5>
                        <span class="badge-preview">#${fila.orden_ejercicio}</span>
                    </div>
                    ${img}
                    <div class="lista-series">`;
        }
        html += `
            <div class="fila-serie-preview row align-items-center text-white">
                <div class="col-6">
                    <span class="badge ${fila.tipo_serie === 'calentamiento' ? 'bg-secondary' : 'bg-success'} mb-1">${fila.tipo_serie}</span>
                    <div class="fw-bold">${fila.reps_objetivo} <span class="text-muted fw-normal">reps</span></div>
                </div>
                <div class="col-6 text-end"><span class="text-muted small">${fila.descanso_info || ''}</span></div>
            </div>`;
    });
    if (ejercicios.length > 0) html += `</div></div>`;
    contenedor.innerHTML = html;
}

// RECURSOS
async function cargarRecursos() {
    const contenedor = document.getElementById('contenedor-recursos');
    contenedor.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-warning"></div></div>';
    
    const { data: recursos, error } = await clienteSupabase.from('recursos').select('*').order('created_at', { ascending: false });
    if (error) return contenedor.innerHTML = '<p class="text-danger">Error</p>';
    contenedor.innerHTML = '';
    if (recursos.length === 0) return contenedor.innerHTML = '<p class="text-muted text-center col-12">No hay archivos.</p>';

    recursos.forEach(r => {
        const icono = r.tipo === 'receta' ? 'bi-egg-fried text-success' : 'bi-lightbulb text-info';
        const borde = r.tipo === 'receta' ? 'border-success' : 'border-info';
        contenedor.innerHTML += `
            <div class="col-md-4 mb-3">
                <div class="card bg-dark-subtle border-start border-4 ${borde} h-100 shadow-sm">
                    <div class="card-body d-flex align-items-center">
                        <i class="bi ${icono} fs-1 me-3"></i>
                        <div class="flex-grow-1 overflow-hidden">
                            <h6 class="text-white mb-1 text-truncate">${r.nombre}</h6>
                            <a href="${r.archivo_url}" target="_blank" class="small text-warning text-decoration-none">Ver archivo</a>
                        </div>
                        <button class="btn btn-sm btn-outline-danger ms-2" onclick="borrarRecurso(${r.id})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
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
        const { error: errUpload } = await clienteSupabase.storage.from('materiales').upload(path, archivo);
        if (errUpload) throw new Error("Error subiendo: " + errUpload.message);

        const { data: urlData } = clienteSupabase.storage.from('materiales').getPublicUrl(path);
        const { error: errDb } = await clienteSupabase.from('recursos').insert([{ nombre: nombre, tipo: tipo, archivo_url: urlData.publicUrl }]);
        if (errDb) throw new Error("Error DB");

        const el = document.getElementById('modalRecurso');
        const modal = bootstrap.Modal.getInstance(el);
        if (modal) modal.hide();
        cargarRecursos();
        Toast.fire({ icon: 'success', title: 'Recurso subido' });
    } catch (error) {
        Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
        document.getElementById('status-recurso').classList.add('d-none');
    }
}

async function borrarRecurso(id) {
    const result = await Popup.fire({ title: '¿Borrar archivo?', icon: 'warning', confirmButtonText: 'Sí, borrar' });
    if(!result.isConfirmed) return;
    
    const { error } = await clienteSupabase.from('recursos').delete().eq('id', id);
    if (error) Toast.fire({ icon: 'error', title: 'Error' });
    else {
        cargarRecursos();
        Toast.fire({ icon: 'success', title: 'Eliminado' });
    }
}

// TOGGLE MENU MÓVIL
function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    sidebar.classList.toggle('active');
    if (sidebar.classList.contains('active')) body.classList.add('menu-open');
    else body.classList.remove('menu-open');
}

// INICIO
document.addEventListener('DOMContentLoaded', () => {
    verificarAdmin();
});