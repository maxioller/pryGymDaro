// js/app.js - VERSIÓN FINAL INTEGRADA

// ==========================================
//      UTILIDAD: FECHA LOCAL
// ==========================================
function obtenerFechaLocal() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`; 
}

// ==========================================
//      1. NAVEGACIÓN (TABS & UI)
// ==========================================
function cambiarTab(tabName) {
    document.getElementById('view-rutina').classList.add('d-none');
    document.getElementById('view-recursos').classList.add('d-none');
    document.getElementById('view-progreso').classList.add('d-none');
    document.getElementById('view-perfil').classList.add('d-none');

    const view = document.getElementById(`view-${tabName}`);
    if(view) view.classList.remove('d-none');

    const botones = document.querySelectorAll('.nav-item-bottom');
    botones.forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('text-secondary'); // Gris por defecto
    });
    
    // Iluminar activo buscando por el onclick
    const activeBtn = Array.from(botones).find(b => b.getAttribute('onclick').includes(tabName));
    if(activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.classList.remove('text-secondary');
    }

    if (tabName === 'progreso') cargarModuloProgreso();

    // Actualizar Header
    const titulos = { 
        'rutina': 'Mi Rutina', 
        'recursos': 'Biblioteca', 
        'progreso': 'Historial', 
        'perfil': 'Mi Cuenta' 
    };
    
    // Si estamos en rutina, mostramos el nombre de la rutina (se actualiza luego), si no, el título fijo
    if(tabName !== 'rutina') {
        document.getElementById('titulo-seccion').innerText = titulos[tabName];
    }

    // Cronómetro visible solo en rutina
    const panelTimer = document.getElementById('panel-cronometro');
    if (tabName === 'rutina') {
        panelTimer.classList.remove('d-none');
        panelTimer.style.display = 'flex'; 
    } else {
        panelTimer.classList.add('d-none');
    }
}


// ==========================================
//      2. CONFIGURACIÓN, SESIÓN Y AVATAR
// ==========================================

async function verificarSesion() {
    const { data: { session } } = await clienteSupabase.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const userId = session.user.id;
    // Traemos también 'avatar_url'
    const { data: perfil } = await clienteSupabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (perfil) {
        if (perfil.rol === 'entrenador') {
            window.location.href = 'admin.html';
            return;
        }
        
        // Llenar textos
        document.getElementById('perfil-nombre').innerText = perfil.nombre || "Usuario";
        document.getElementById('perfil-email').innerText = session.user.email;
        
        // Saludo header
        const nombreCorto = perfil.nombre ? perfil.nombre.split(' ')[0] : 'Atleta';
        const divSaludo = document.getElementById('header-saludo');
        if (divSaludo) divSaludo.innerText = `¡HOLA, ${nombreCorto.toUpperCase()}! 👋`;

        // Renderizamos el avatar grande en la sección perfil
        const container = document.getElementById('avatar-container-perfil');
        if (container) {
            container.innerHTML = generarHTMLAvatar(perfil.avatar_url, perfil.nombre, 100, 'fs-1');
        }
    }

    cargarRutinaActiva(userId);
}

// Helper: Generar HTML de Avatar (Foto o Inicial)
function generarHTMLAvatar(url, nombre, size = 50, fontSizeClass = 'fs-4') {
    if (url) {
        // Opción A: Tiene Foto (Agregamos timestamp para evitar caché al actualizar)
        return `<img src="${url}?t=${Date.now()}" 
                     class="rounded-circle border border-2 border-secondary object-fit-cover" 
                     style="width: ${size}px; height: ${size}px;">`;
    } else {
        // Opción B: No tiene foto -> Inicial
        const inicial = nombre ? nombre.charAt(0).toUpperCase() : '?';
        return `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center border border-2 border-dark text-white fw-bold ${fontSizeClass}" 
                     style="width: ${size}px; height: ${size}px;">
                    ${inicial}
                </div>`;
    }
}

// Función para subir avatar a Supabase Storage
async function subirAvatar(input) {
    if (input.files.length === 0) return;
    const archivo = input.files[0];
    
    // UI Loading en el perfil
    const container = document.getElementById('avatar-container-perfil');
    container.innerHTML = `<div class="spinner-border text-warning" style="width: 3rem; height: 3rem;"></div>`;

    try {
        const { data: { user } } = await clienteSupabase.auth.getUser();
        
        // 1. Subir imagen (Sobrescribimos usando el ID del usuario)
        const ext = archivo.name.split('.').pop();
        const path = `avatar_${user.id}.${ext}`;

        const { error: uploadError } = await clienteSupabase.storage
            .from('avatars')
            .upload(path, archivo, { upsert: true });

        if (uploadError) throw uploadError;

        // 2. Obtener URL Pública
        const { data: urlData } = clienteSupabase.storage
            .from('avatars')
            .getPublicUrl(path);

        const publicUrl = urlData.publicUrl;

        // 3. Guardar URL en tabla perfiles
        const { error: dbError } = await clienteSupabase
            .from('perfiles')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (dbError) throw dbError;

        // 4. Actualizar UI
        const nombreActual = document.getElementById('perfil-nombre').innerText;
        container.innerHTML = generarHTMLAvatar(publicUrl, nombreActual, 100, 'fs-1');

        Toast.fire({ icon: 'success', title: 'Foto actualizada' });

    } catch (error) {
        console.error(error);
        Toast.fire({ icon: 'error', title: 'Error al subir', text: error.message });
        verificarSesion(); // Restaurar estado anterior si falla
    }
}

// Botón Cerrar Sesión con Confirmación
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        const result = await Popup.fire({
            title: '¿Ya te vas?',
            text: "Cerrarás tu sesión actual.",
            icon: 'question',
            confirmButtonText: 'Sí, salir'
        });

        if (result.isConfirmed) {
            await clienteSupabase.auth.signOut();
            window.location.href = 'login.html';
        }
    });
}


// ==========================================
//      3. CARGA DE RUTINA Y RECURSOS
// ==========================================

async function cargarRutinaActiva(userId) {
    // Si userId no viene (ej. recarga), lo buscamos
    if(!userId) {
        const { data: { user } } = await clienteSupabase.auth.getUser();
        userId = user.id;
    }

    const { data: asignacion, error } = await clienteSupabase
        .from('asignaciones_rutinas')
        .select(`rutina_id, rutinas(*), receta:recurso_receta_id ( nombre, archivo_url, tipo ), sugerencia:recurso_sugerencia_id ( nombre, archivo_url, tipo )`)
        .eq('cliente_id', userId)
        .eq('activa', true)
        .single();

    if (error || !asignacion) {
        document.getElementById('contenedor-rutina').innerHTML = `
            <div class="alert alert-warning text-center mt-5 bg-dark border-warning text-warning">
                <h4><i class="bi bi-exclamation-triangle"></i></h4>
                <p>Tu entrenador aún no te ha asignado una rutina.</p>
            </div>`;
        document.getElementById('contenedor-botones-dias').innerHTML = "";
        return;
    }

    const rutina = asignacion.rutinas;
    // Actualizamos el título del header con el nombre de la rutina
    document.getElementById('titulo-seccion').innerText = rutina.nombre;

    // --- RECURSOS ---
    const contenedorRecursos = document.getElementById('lista-recursos');
    contenedorRecursos.innerHTML = "";
    const recursos = [];
    if (asignacion.receta) recursos.push(asignacion.receta);
    if (asignacion.sugerencia) recursos.push(asignacion.sugerencia);

    if (recursos.length > 0) {
        recursos.forEach(r => {
            const icono = r.tipo === 'receta' ? 'bi-egg-fried' : 'bi-lightbulb';
            const color = r.tipo === 'receta' ? 'text-success' : 'text-warning';
            const border = r.tipo === 'receta' ? 'border-success' : 'border-warning';

            contenedorRecursos.innerHTML += `
                <div class="col-12 col-md-6 animate__animated animate__fadeIn">
                    <div class="card bg-dark-subtle border-start border-4 ${border} shadow-sm" 
                         onclick="abrirVisor('${r.archivo_url}', '${r.nombre}')" style="cursor: pointer;">
                        <div class="card-body d-flex align-items-center p-3">
                            <div class="rounded-circle bg-black d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px;">
                                <i class="bi ${icono} fs-3 ${color}"></i>
                            </div>
                            <div>
                                <h6 class="text-white mb-0 text-truncate" style="max-width: 200px;">${r.nombre}</h6>
                                <small class="text-muted">Toque para ver</small>
                            </div>
                            <i class="bi bi-chevron-right text-secondary ms-auto"></i>
                        </div>
                    </div>
                </div>`;
        });
    } else {
        contenedorRecursos.innerHTML = '<div class="text-center text-muted mt-5"><i class="bi bi-folder-x fs-1"></i><p>No hay recursos.</p></div>';
    }

    cargarBotonesDias(rutina.id);
}

async function cargarBotonesDias(rutinaId) {
    const contenedorBtn = document.getElementById('contenedor-botones-dias');
    const { data: dias, error } = await clienteSupabase
        .from('rutinas_dias')
        .select('*')
        .eq('rutina_id', rutinaId)
        .order('dia_numero', { ascending: true });

    if (error || dias.length === 0) return;

    // Filtramos días únicos por si acaso
    const diasUnicos = [];
    const numerosVistos = new Set();
    dias.forEach(d => {
        if (!numerosVistos.has(d.dia_numero)) {
            numerosVistos.add(d.dia_numero);
            diasUnicos.push(d);
        }
    });

    contenedorBtn.innerHTML = "";
    diasUnicos.forEach((dia, index) => {
        const btn = document.createElement('button');
        const claseColor = index === 0 ? 'btn-warning fw-bold' : 'btn-outline-secondary';
        btn.className = `btn ${claseColor} flex-shrink-0 px-4`;
        btn.innerText = `Día ${dia.dia_numero}`;
        btn.onclick = () => {
            document.querySelectorAll('#contenedor-botones-dias button').forEach(b => b.className = 'btn btn-outline-secondary flex-shrink-0 px-4');
            btn.className = 'btn btn-warning fw-bold flex-shrink-0 px-4';
            cargarEjerciciosDelDia(dia.id);
        };
        contenedorBtn.appendChild(btn);
    });

    if (diasUnicos.length > 0) cargarEjerciciosDelDia(diasUnicos[0].id);
}


// ==========================================
//      4. EJERCICIOS (SKELETON + RENDER CORREGIDO)
// ==========================================

async function cargarEjerciciosDelDia(diaId) {
    const contenedor = document.getElementById('contenedor-rutina');
    
    // 1. MOSTRAR SKELETON (Efecto de carga)
    let skeletonHTML = '';
    for(let i=0; i<3; i++) {
        skeletonHTML += `
            <div class="card card-ejercicio p-3 animate__animated animate__fadeIn">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton" style="width: 30px; height: 30px; border-radius: 50%;"></div>
                </div>
                <div class="skeleton skeleton-img"></div>
                <div class="row mt-3">
                    <div class="col-5"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width: 50%"></div></div>
                    <div class="col-5"><div class="skeleton skeleton-btn ms-auto"></div></div>
                    <div class="col-2"><div class="skeleton" style="width: 30px; height: 30px;"></div></div>
                </div>
            </div>`;
    }
    contenedor.innerHTML = skeletonHTML;

    // 2. FETCH DATOS REALES
    const { data: ejercicios, error: errorRutina } = await clienteSupabase
        .from('rutinas_detalles')
        .select(`*, ejercicios_catalogo ( nombre, imagen_url )`)
        .eq('dia_id', diaId)
        .order('orden_ejercicio', { ascending: true })
        .order('orden_serie', { ascending: true });

    if (errorRutina) {
        contenedor.innerHTML = '<div class="alert alert-danger">Error al cargar ejercicios.</div>';
        Toast.fire({ icon: 'error', title: 'Error de conexión' });
        return;
    }

    const hoy = obtenerFechaLocal();
    const { data: { user } } = await clienteSupabase.auth.getUser();

    const { data: historial } = await clienteSupabase
        .from('historial_usuario')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('fecha_entrenamiento', hoy);

    renderizarTarjetas(ejercicios, historial || []);
}

function renderizarTarjetas(datosRutina, datosHistorial) {
    const contenedor = document.getElementById('contenedor-rutina');
    contenedor.innerHTML = ""; 

    if (!datosRutina || datosRutina.length === 0) {
        contenedor.innerHTML = `<div class="alert alert-info text-center opacity-75 mt-5">Descanso o sin ejercicios asignados.</div>`;
        return;
    }

    let html = "";
    let tarjetaActualIdx = null;

    datosRutina.forEach((fila) => {
        const datoGuardado = datosHistorial.find(h => h.ejercicio_id === fila.ejercicio_id);
        const pesoPrevio = datoGuardado ? datoGuardado.peso_real : '';
        const estaCompletado = datoGuardado && datoGuardado.completado ? 'checked' : '';

        // Header Tarjeta
        const esNuevaTarjeta = fila.orden_ejercicio !== tarjetaActualIdx;
        const nombreEjercicio = fila.ejercicios_catalogo?.nombre || "Ejercicio";

        if (esNuevaTarjeta) {
            if (tarjetaActualIdx !== null) html += `</div></div>`; 
            tarjetaActualIdx = fila.orden_ejercicio;

            const htmlNotaGeneral = fila.nota_ejercicio 
                ? `<div class="alert alert-dark border-warning text-warning small mb-3 p-2"><i class="bi bi-info-circle-fill me-2"></i>${fila.nota_ejercicio}</div>` : '';

            const urlImagen = fila.ejercicios_catalogo?.imagen_url;
            const htmlImagen = urlImagen
                ? `<div class="text-center mb-3"><img src="${urlImagen}" class="img-fluid rounded" style="max-height: 200px;" onerror="this.parentElement.style.display='none'"></div>` : '';

            html += `
                <div class="card card-ejercicio p-3 animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h4 class="m-0 text-white fw-bold" style="max-width: 75%; font-size: 1.1rem;">${nombreEjercicio}</h4>
                        
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-dark border-secondary text-warning" 
                                    onclick="abrirGrafico(${fila.ejercicio_id}, '${nombreEjercicio}')">
                                <i class="bi bi-graph-up"></i>
                            </button>
                            <span class="badge-numero">#${fila.orden_ejercicio}</span>
                        </div>
                    </div>
                    ${htmlImagen}
                    ${htmlNotaGeneral}
                    <div class="lista-series">`;
        }

        // Fila Serie (LAYOUT CORREGIDO: Input + KG Separados)
        const esCalentamiento = fila.tipo_serie === 'calentamiento';
        const badgeColor = esCalentamiento ? 'bg-secondary' : 'bg-success';
        const textoSerie = fila.tipo_serie ? fila.tipo_serie.toUpperCase() : 'TRABAJO';
        const htmlObservacionFila = fila.observaciones 
            ? `<div class="text-secondary small fst-italic my-1"><i class="bi bi-caret-right-fill"></i> ${fila.observaciones}</div>` : '';

        html += `
            <div class="row fila-serie align-items-center">
                <div class="col-5">
                    <span class="badge ${badgeColor} mb-1" style="font-size: 0.65em;">${textoSerie}</span>
                    <div class="fw-bold fs-5 text-white">${fila.reps_objetivo} <span class="fs-6 fw-normal text-secondary">reps</span></div>
                    ${htmlObservacionFila}
                </div>
                
                <div class="col-5">
                    <div class="d-flex align-items-center justify-content-end gap-2">
                        <input type="number" class="form-control input-peso" placeholder="0" value="${pesoPrevio}" 
                               style="width: 70px;"
                               onchange="guardarProgreso(${fila.id}, ${fila.ejercicio_id}, 'peso', this.value)">
                        <span class="badge-kg">kg</span>
                    </div>
                </div>
                
                <div class="col-2 text-end">
                    <input type="checkbox" class="form-check-input ms-auto"
                           ${estaCompletado} onchange="guardarProgreso(${fila.id}, ${fila.ejercicio_id}, 'check', this.checked)">
                </div>
            </div>`;
    });

    if (datosRutina.length > 0) html += `</div></div>`;
    contenedor.innerHTML = html;
}

// Guardar Progreso (Silent Success)
async function guardarProgreso(detalleId, ejercicioId, tipo, valor) {
    const { data: { user } } = await clienteSupabase.auth.getUser();
    const hoy = obtenerFechaLocal();
    const datosUpsert = { usuario_id: user.id, ejercicio_id: ejercicioId, fecha_entrenamiento: hoy };
    
    if (detalleId) datosUpsert.rutina_detalle_id = detalleId;
    if (tipo === 'peso') datosUpsert.peso_real = valor;
    if (tipo === 'check') datosUpsert.completado = valor;

    const { error } = await clienteSupabase
        .from('historial_usuario')
        .upsert(datosUpsert, { onConflict: 'usuario_id, ejercicio_id, fecha_entrenamiento' });
        
    if (error) {
        console.error("Error guardando:", error);
        Toast.fire({ icon: 'error', title: 'Error al guardar', text: 'Revisa tu conexión.' });
    }
}


// ==========================================
//      5. MÓDULO PROGRESO (HISTORIAL)
// ==========================================

async function cargarModuloProgreso() {
    const contenedor = document.getElementById('lista-historial-ejercicios');
    contenedor.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-warning"></div></div>';
    const { data: { user } } = await clienteSupabase.auth.getUser();

    const { data: historial, error } = await clienteSupabase
        .from('historial_usuario')
        .select(`ejercicio_id, ejercicios_catalogo ( nombre )`)
        .eq('usuario_id', user.id);

    if (error || !historial || historial.length === 0) {
        contenedor.innerHTML = '<div class="alert alert-dark text-center text-muted border-secondary">Aún no has registrado datos.</div>';
        return;
    }

    const ejerciciosUnicos = {};
    historial.forEach(item => {
        if (item.ejercicios_catalogo) ejerciciosUnicos[item.ejercicio_id] = item.ejercicios_catalogo.nombre;
    });

    contenedor.innerHTML = "";
    Object.keys(ejerciciosUnicos).forEach(id => {
        const nombre = ejerciciosUnicos[id];
        contenedor.innerHTML += `
            <div class="card bg-dark border-secondary shadow-sm" onclick="abrirGrafico(${id}, '${nombre}')">
                <div class="card-body py-3 d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle bg-warning d-flex justify-content-center align-items-center" style="width: 40px; height: 40px;">
                            <i class="bi bi-graph-up-arrow text-black"></i>
                        </div>
                        <h6 class="mb-0 text-white">${nombre}</h6>
                    </div>
                    <i class="bi bi-chevron-right text-secondary"></i>
                </div>
            </div>`;
    });
}


// ==========================================
//      6. FUNCIONES MODALES Y CRONÓMETRO
// ==========================================

function abrirVisor(url, nombre) {
    const modal = new bootstrap.Modal(document.getElementById('modalVisor'));
    const contenedor = document.getElementById('contenido-visor');
    const btnDescarga = document.getElementById('btn-descargar-visor');
    document.getElementById('tituloVisor').innerText = nombre;
    btnDescarga.href = url;

    const ext = url.split('.').pop().toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
        contenedor.innerHTML = `<img src="${url}" class="img-fluid" style="max-height: 80vh; object-fit: contain;">`;
    } else {
        contenedor.innerHTML = `<iframe src="${url}" width="100%" height="100%" style="border:none; min-height: 80vh;"></iframe>`;
    }
    modal.show();
}

let miChartInstancia = null;
async function abrirGrafico(ejercicioId, nombre) {
    const modal = new bootstrap.Modal(document.getElementById('modalGrafico'));
    modal.show();
    document.getElementById('tituloGrafico').innerText = nombre;

    const { data: { user } } = await clienteSupabase.auth.getUser();
    const { data: historial } = await clienteSupabase
        .from('historial_usuario')
        .select('fecha_entrenamiento, peso_real')
        .eq('usuario_id', user.id)
        .eq('ejercicio_id', ejercicioId)
        .gt('peso_real', 0)
        .order('fecha_entrenamiento', { ascending: true })
        .limit(20);

    const etiquetas = historial ? historial.map(h => {
        const partes = h.fecha_entrenamiento.split('-'); 
        return `${partes[2]}/${partes[1]}`; 
    }) : [];
    const valores = historial ? historial.map(h => h.peso_real) : [];

    const ctx = document.getElementById('miGrafico').getContext('2d');
    if (miChartInstancia) miChartInstancia.destroy();

    miChartInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Peso (kg)',
                data: valores,
                borderColor: '#ffc107',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#fff' } } },
            scales: {
                y: { grid: { color: '#333' }, ticks: { color: '#aaa' } },
                x: { grid: { color: '#333' }, ticks: { color: '#aaa' } }
            }
        }
    });
}

// CRONÓMETRO
let timerInterval, timerSeconds = 0, isRunning = false;
function toggleTimer() {
    const btn = document.getElementById('btn-timer-toggle');
    const icon = btn.querySelector('i');
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        btn.classList.replace('btn-danger', 'btn-warning');
        icon.classList.replace('bi-pause-fill', 'bi-play-fill');
    } else {
        isRunning = true;
        btn.classList.replace('btn-warning', 'btn-danger');
        icon.classList.replace('bi-play-fill', 'bi-pause-fill');
        timerInterval = setInterval(() => {
            timerSeconds++;
            const min = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
            const sec = (timerSeconds % 60).toString().padStart(2, '0');
            document.getElementById('timer-display').innerText = `${min}:${sec}`;
        }, 1000);
    }
}
function resetTimer() {
    if (isRunning) toggleTimer();
    timerSeconds = 0;
    document.getElementById('timer-display').innerText = "00:00";
}

// INICIO
document.addEventListener('DOMContentLoaded', () => {
    verificarSesion();
});