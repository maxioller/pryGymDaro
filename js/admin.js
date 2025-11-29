// js/admin.js - VERSIÓN FINAL MODULAR (CRM + FINANZAS + ENTRENAMIENTO)

// VARIABLES GLOBALES
let idClienteSeleccionado = null; // Para la ficha de cliente

// ==========================================
//      1. SEGURIDAD Y NAVEGACIÓN
// ==========================================

async function verificarAdmin() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
    } else {
        cargarEjercicios();
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
    const secciones = ['ejercicios', 'rutinas', 'crear-rutina', 'clientes', 'recursos', 'ficha-cliente'];
    secciones.forEach(s => {
        const el = document.getElementById(`vista-${s}`);
        if(el) el.classList.add('d-none');
    });

    const botones = ['ejercicios', 'rutinas', 'clientes', 'recursos'];
    botones.forEach(b => {
        const btn = document.getElementById(`btn-nav-${b}`);
        if(btn) btn.className = 'nav-link text-white link-opacity-75-hover';
    });

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
//      2. GESTIÓN DE CLIENTES & FICHA CRM
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
                    <button class="btn btn-sm btn-outline-light" onclick="abrirFichaCliente('${cliente.id}')" title="Ver Ficha Completa"><i class="bi bi-person-lines-fill"></i></button>
                </td>
            </tr>`;
        tbody.innerHTML += fila;
    });
}

// --- FICHA CLIENTE (CRM) ---
async function abrirFichaCliente(id) {
    idClienteSeleccionado = id;
    
    // UI Change
    document.getElementById('vista-clientes').classList.add('d-none');
    document.getElementById('vista-ficha-cliente').classList.remove('d-none');
    
    // Load Personal Data
    const { data: perfil } = await clienteSupabase.from('perfiles').select('*').eq('id', id).single();
    
    document.getElementById('ficha-nombre').innerText = perfil.nombre;
    document.getElementById('crm-telefono').value = perfil.telefono || '';
    document.getElementById('crm-nacimiento').value = perfil.fecha_nacimiento || '';
    document.getElementById('crm-direccion').value = perfil.direccion || '';
    document.getElementById('crm-emergencia-nombre').value = perfil.contacto_emergencia_nombre || '';
    document.getElementById('crm-emergencia-tel').value = perfil.contacto_emergencia_telefono || '';
    document.getElementById('crm-notas').value = perfil.observaciones_admin || '';

    // Update Top Badge
    const divEstado = document.getElementById('ficha-estado');
    if(perfil.fecha_vencimiento_pago) {
        divEstado.className = 'badge bg-success';
        divEstado.innerText = `Vence: ${perfil.fecha_vencimiento_pago}`;
    } else {
        divEstado.className = 'badge bg-danger';
        divEstado.innerText = 'Sin Pago';
    }

    // Load Payments & Routine
    cargarHistorialPagos(id);
    cargarRutinaActualCRM(id);
}

function cerrarFichaCliente() {
    document.getElementById('vista-ficha-cliente').classList.add('d-none');
    document.getElementById('vista-clientes').classList.remove('d-none');
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

    if (!monto || monto <= 0) return Toast.fire({ icon: 'warning', title: 'Ingresa un monto válido' });

    // Calc Date
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

    // Insert History
    const { error: errHist } = await clienteSupabase.from('pagos_historial').insert([{
        cliente_id: idClienteSeleccionado, monto: monto, meses_abonados: meses, metodo_pago: metodo
    }]);
    if (errHist) return Toast.fire({ icon: 'error', title: 'Error historial', text: errHist.message });

    // Update Profile
    const { error: errPerf } = await clienteSupabase.from('perfiles').update({ fecha_vencimiento_pago: fechaSQL, pago_al_dia: true }).eq('id', idClienteSeleccionado);
    if (errPerf) return Toast.fire({ icon: 'error', title: 'Error perfil', text: errPerf.message });

    Toast.fire({ icon: 'success', title: 'Pago registrado', text: `Vence: ${fechaSQL}` });
    document.getElementById('fin-monto').value = ""; 
    cargarHistorialPagos(idClienteSeleccionado);
    document.getElementById('ficha-estado').innerText = `Vence: ${fechaSQL}`;
    document.getElementById('ficha-estado').className = 'badge bg-success';
}

async function cargarHistorialPagos(id) {
    const tbody = document.getElementById('tabla-historial-pagos');
    tbody.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
    const { data: pagos } = await clienteSupabase.from('pagos_historial').select('*').eq('cliente_id', id).order('fecha_pago', { ascending: false });
    
    tbody.innerHTML = '';
    if (!pagos || pagos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-muted">Sin pagos registrados</td></tr>';
        return;
    }
    pagos.forEach(p => {
        const fecha = new Date(p.fecha_pago).toLocaleDateString();
        tbody.innerHTML += `<tr><td class="text-secondary">${fecha}</td><td>${p.meses_abonados} Mes(es) <span class="badge bg-dark border border-secondary text-secondary">${p.metodo_pago}</span></td><td class="text-success fw-bold">$${p.monto}</td></tr>`;
    });
}

async function revocarAcceso() {
    if(!confirm("¿Quitar acceso inmediatamente?")) return;
    await clienteSupabase.from('perfiles').update({ fecha_vencimiento_pago: '2020-01-01' }).eq('id', idClienteSeleccionado);
    Toast.fire({ icon: 'success', title: 'Acceso revocado' });
    document.getElementById('ficha-estado').innerText = 'Sin Pago';
    document.getElementById('ficha-estado').className = 'badge bg-danger';
}

// EN js/admin.js

// EN js/admin.js

async function cargarRutinaActualCRM(id) {
    // 1. Buscamos los elementos en el HTML
    const lblActual = document.getElementById('crm-rutina-actual');
    const tbody = document.getElementById('tabla-historial-rutinas');

    // Validación de seguridad: si no encuentra la tabla, frena para no romper todo
    if (!lblActual || !tbody) {
        console.error("Error: No encuentro los elementos de la tabla historial en el HTML");
        return;
    }
    
    // 2. Limpiamos antes de cargar
    lblActual.innerText = "Cargando...";
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-3"><div class="spinner-border text-warning spinner-border-sm"></div></td></tr>';

    // 3. Consultamos a Supabase
    const { data: asignaciones, error } = await clienteSupabase
        .from('asignaciones_rutinas')
        .select('created_at, activa, rutinas(nombre)')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false });

    // Si hubo error o no hay datos
    if (error || !asignaciones || asignaciones.length === 0) {
        lblActual.innerText = "Sin Rutina Activa";
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4 small fst-italic">El cliente nunca tuvo rutinas asignadas.</td></tr>';
        return;
    }

    // 4. Procesamos los datos para mostrarlos
    tbody.innerHTML = ""; // Limpiar spinner
    let hayActiva = false;

    asignaciones.forEach(asig => {
        // Formato de fecha
        const dateObj = new Date(asig.created_at);
        const fecha = dateObj.toLocaleDateString();
        const hora = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const nombreRutina = asig.rutinas ? asig.rutinas.nombre : '(Rutina Eliminada)';

        if (asig.activa) {
            hayActiva = true;
            // A. ACTIVA (Tarjeta Grande + Fila Destacada)
            lblActual.innerText = nombreRutina;
            
            tbody.innerHTML += `
                <tr class="fila-activa">
                    <td class="ps-3 py-3">
                        <div class="text-warning fw-bold small mb-1">ASIGNADA EL</div>
                        <div class="text-white">${fecha} <small class="text-secondary opacity-75">${hora}</small></div>
                    </td>
                    <td class="py-3">
                        <div class="text-warning fw-bold small mb-1">RUTINA</div>
                        <div class="text-white fw-bold fs-5">${nombreRutina}</div>
                    </td>
                    <td class="text-end pe-3 py-3 align-middle">
                        <span class="badge bg-warning text-dark border border-warning shadow-sm">
                            <i class="bi bi-check-circle-fill me-1"></i>ACTIVA
                        </span>
                    </td>
                </tr>`;
        } else {
            // B. HISTORIAL (Sutil)
            tbody.innerHTML += `
                <tr>
                    <td class="ps-3 py-3 align-middle">
                        <div class="text-dimmed small">${fecha}</div>
                    </td>
                    <td class="py-3 align-middle">
                        <div class="text-secondary">${nombreRutina}</div>
                    </td>
                    <td class="text-end pe-3 py-3 align-middle">
                        <span class="badge bg-dark border border-secondary text-secondary">
                            <i class="bi bi-clock-history me-1"></i>Archivada
                        </span>
                    </td>
                </tr>`;
        }
    });

    if (!hayActiva) {
        lblActual.innerText = "Sin Rutina Activa";
    }
}

function abrirModalAsignarDesdeFicha() {
    const nombre = document.getElementById('ficha-nombre').innerText;
    abrirModalAsignar(idClienteSeleccionado, nombre);
}


// ==========================================
//      3. GESTIÓN DE EJERCICIOS (CRUD + SKELETON)
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
    const result = await Popup.fire({ title: '¿Borrar ejercicio?', text: "Esta acción no se puede deshacer.", icon: 'warning', confirmButtonText: 'Sí, borrar' });
    if (!result.isConfirmed) return;
    const { data: ejercicio } = await clienteSupabase.from('ejercicios_catalogo').select('imagen_url').eq('id', id).single();
    if (ejercicio && ejercicio.imagen_url && ejercicio.imagen_url.includes('supabase')) {
        try { await clienteSupabase.storage.from('ejercicios').remove([ejercicio.imagen_url.split('/').pop()]); } catch (e) { console.error(e); }
    }
    const { error } = await clienteSupabase.from('ejercicios_catalogo').delete().eq('id', id);
    if (error) Toast.fire({ icon: 'error', title: 'Error al borrar', text: error.message });
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
    if (rutinas.length === 0) return tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay rutinas.</td></tr>';
    rutinas.forEach(rutina => {
        const fila = `<tr><td class="fw-bold text-white">${rutina.nombre}</td><td><span class="badge bg-info text-dark">Plantilla</span></td><td>${rutina.nivel_dias} días</td><td class="text-end"><button class="btn btn-sm btn-outline-info me-1" onclick="previsualizarRutina(${rutina.id})"><i class="bi bi-eye"></i></button><button class="btn btn-sm btn-outline-warning me-1" onclick="editarRutina(${rutina.id})"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-danger" onclick="borrarRutina(${rutina.id})"><i class="bi bi-trash"></i></button></td></tr>`;
        tbody.innerHTML += fila;
    });
}

async function borrarRutina(id) {
    const result = await Popup.fire({ title: '¿Eliminar rutina?', icon: 'warning', confirmButtonText: 'Sí, eliminar' });
    if (!result.isConfirmed) return;
    const { error } = await clienteSupabase.from('rutinas').delete().eq('id', id);
    if (error) Toast.fire({ icon: 'error', title: 'Error', text: error.message });
    else { cargarRutinas(); Toast.fire({ icon: 'success', title: 'Eliminada' }); }
}

let rutinaTemporal = { nombre: "", dias: { 1: [] }, diaSeleccionado: 1 };
let idRutinaEnEdicion = null; 

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
    // Reindexar días
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

// ASIGNACIÓN
async function abrirModalAsignar(clienteId, nombreCliente) {
    document.getElementById('idClienteAsignar').value = clienteId;
    document.getElementById('nombreClienteAsignar').innerText = nombreCliente;
    const selRutina = document.getElementById('selectRutinaAsignar');
    selRutina.innerHTML = '<option>Cargando...</option>';
    const { data: rutinas } = await clienteSupabase.from('rutinas').select('id, nombre').eq('es_plantilla', true).order('nombre');
    selRutina.innerHTML = '';
    rutinas.forEach(r => selRutina.innerHTML += `<option value="${r.id}">${r.nombre}</option>`);
    
    // Cargar recursos (Receta/Sugerencia)
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
    
    // Si estamos en la ficha, refrescamos la info ahí, sino en la tabla
    if(!document.getElementById('vista-ficha-cliente').classList.contains('d-none')) {
        cargarRutinaActualCRM(clienteId);
    } else {
        cargarClientes();
    }
    Toast.fire({ icon: 'success', title: 'Asignado' });
}

// PREVISUALIZAR, RECURSOS Y MENU
async function previsualizarRutina(id) { /* ... (Igual que antes) ... */ 
    const modal = new bootstrap.Modal(document.getElementById('modalPrevisualizar'));
    modal.show();
    // (Por brevedad omito el body, usa el que tenías, funciona igual)
} 
// (Mantén tus funciones de Recursos y toggleMenu aquí al final)
async function cargarRecursos() { /* ... */ }
function abrirModalRecurso() { /* ... */ }
async function guardarRecurso() { /* ... */ }
async function borrarRecurso(id) { /* ... */ }
function toggleMenu() { document.querySelector('.sidebar').classList.toggle('active'); document.body.classList.toggle('menu-open'); }

// INICIO
document.addEventListener('DOMContentLoaded', () => { verificarAdmin(); });