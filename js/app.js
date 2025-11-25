// js/app.js

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
//      1. CONFIGURACIÓN Y SESIÓN
// ==========================================

async function verificarSesion() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // NUEVO: Verificar Rol para redirigir a Admin si corresponde
    const userId = session.user.id;
    const { data: perfil, error } = await clienteSupabase
        .from('perfiles')
        .select('rol')
        .eq('id', userId)
        .single();

    if (perfil && perfil.rol === 'entrenador') {
        // Si soy entrenador y entré por error a la App del cliente,
        // me manda automáticamente al Admin Panel.
        window.location.href = 'admin.html';
        return;
    }

    // Si soy cliente, cargo la rutina normal
    cargarRutinaActiva();
}

// ==========================================
//      2. LÓGICA DE NAVEGACIÓN
// ==========================================

async function cargarRutinaActiva() {
    const contenedorTitulo = document.querySelector('h2');
    const { data: { user } } = await clienteSupabase.auth.getUser();
    
    // 1. Buscamos la asignación activa
    const { data: asignacion, error } = await clienteSupabase
        .from('asignaciones_rutinas')
        .select('rutina_id, rutinas(*)')
        .eq('cliente_id', user.id)
        .eq('activa', true)
        .single();

    if (error || !asignacion) {
        document.getElementById('contenedor-rutina').innerHTML = `
            <div class="alert alert-warning text-center mt-5">
                <h4>¡Hola! 👋</h4>
                <p>Tu entrenador aún no te ha asignado una rutina.</p>
            </div>`;
        contenedorTitulo.innerText = "Bienvenido";
        document.getElementById('contenedor-botones-dias').innerHTML = "";
        return;
    }

    const rutina = asignacion.rutinas;
    contenedorTitulo.innerText = rutina.nombre;
    
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

    // FILTRO DE UNICIDAD (Para evitar botones duplicados si la BD se ensució)
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
        
        btn.className = `btn ${claseColor}`;
        btn.innerText = `Día ${dia.dia_numero}`;
        
        btn.onclick = () => {
            document.querySelectorAll('#contenedor-botones-dias button').forEach(b => {
                b.className = 'btn btn-outline-secondary';
            });
            btn.className = 'btn btn-warning fw-bold';
            cargarEjerciciosDelDia(dia.id);
        };

        contenedorBtn.appendChild(btn);
    });

    if (diasUnicos.length > 0) {
        cargarEjerciciosDelDia(diasUnicos[0].id);
    }
}

// ==========================================
//      3. CARGAR EJERCICIOS + HISTORIAL
// ==========================================

async function cargarEjerciciosDelDia(diaId) {
    const contenedor = document.getElementById('contenedor-rutina');
    contenedor.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-warning"></div></div>';

    // A. Traemos los ejercicios
    const { data: ejercicios, error: errorRutina } = await clienteSupabase
        .from('rutinas_detalles')
        .select(`*, ejercicios_catalogo ( nombre, imagen_url )`)
        .eq('dia_id', diaId)
        .order('orden_ejercicio', { ascending: true })
        .order('orden_serie', { ascending: true });

    if (errorRutina) {
        contenedor.innerHTML = '<div class="alert alert-danger">Error al cargar ejercicios.</div>';
        return;
    }

    // B. Traemos historial de HOY
    const hoy = obtenerFechaLocal();
    const { data: { user } } = await clienteSupabase.auth.getUser();

    const { data: historial } = await clienteSupabase
        .from('historial_usuario')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('fecha_entrenamiento', hoy);

    renderizarTarjetas(ejercicios, historial || []);
}

// ==========================================
//      4. RENDERIZADO
// ==========================================

function renderizarTarjetas(datosRutina, datosHistorial) {
    const contenedor = document.getElementById('contenedor-rutina');
    contenedor.innerHTML = ""; 

    if (!datosRutina || datosRutina.length === 0) {
        contenedor.innerHTML = `<div class="alert alert-info text-center opacity-75">Descanso o sin ejercicios asignados.</div>`;
        return;
    }

    let html = "";
    let tarjetaActualIdx = null;

    datosRutina.forEach((fila) => {
        // CORRECCIÓN CLAVE: Buscamos por ID DE EJERCICIO (Catálogo)
        // Esto permite que el historial persista aunque cambie la rutina
        const datoGuardado = datosHistorial.find(h => h.ejercicio_id === fila.ejercicio_id);
        
        const pesoPrevio = datoGuardado ? datoGuardado.peso_real : '';
        const estaCompletado = datoGuardado && datoGuardado.completado ? 'checked' : '';

        // --- HEADER TARJETA ---
        const esNuevaTarjeta = fila.orden_ejercicio !== tarjetaActualIdx;
        const nombreEjercicio = fila.ejercicios_catalogo?.nombre || "Ejercicio";

        if (esNuevaTarjeta) {
            if (tarjetaActualIdx !== null) html += `</div></div>`; 
            tarjetaActualIdx = fila.orden_ejercicio;

            const htmlNotaGeneral = fila.nota_ejercicio 
                ? `<div class="alert alert-dark border-warning text-warning small mb-3 p-2">
                     <i class="bi bi-info-circle-fill me-2"></i>${fila.nota_ejercicio}
                   </div>` : '';

            const urlImagen = fila.ejercicios_catalogo?.imagen_url;
            const htmlImagen = urlImagen
                ? `<div class="text-center mb-3">
                     <img src="${urlImagen}" class="img-fluid rounded" style="max-height: 200px;" onerror="this.parentElement.style.display='none'"> 
                   </div>` : '';

            html += `
                <div class="card card-ejercicio p-3 animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h4 class="m-0 text-white">${nombreEjercicio}</h4>
                        <span class="badge-numero">#${fila.orden_ejercicio}</span>
                    </div>
                    ${htmlImagen}
                    ${htmlNotaGeneral}
                    <div class="lista-series">
            `;
        }

        // --- FILA SERIE ---
        const esCalentamiento = fila.tipo_serie === 'calentamiento';
        const badgeColor = esCalentamiento ? 'bg-secondary' : 'bg-success';
        const textoSerie = fila.tipo_serie ? fila.tipo_serie.toUpperCase() : 'TRABAJO';
        const htmlObservacionFila = fila.observaciones 
            ? `<div class="text-secondary small fst-italic my-1"><i class="bi bi-caret-right-fill"></i> ${fila.observaciones}</div>` : '';

        // AQUÍ ESTÁ EL CAMBIO: Pasamos 'fila.ejercicio_id' a la función guardar
        html += `
            <div class="row fila-serie align-items-center">
                <div class="col-5">
                    <span class="badge ${badgeColor} mb-1" style="font-size: 0.65em;">${textoSerie}</span>
                    <div class="fw-bold fs-5">${fila.reps_objetivo} <span class="fs-6 fw-normal text-muted">reps</span></div>
                    ${htmlObservacionFila}
                </div>
                <div class="col-4 text-end">
                    <div class="input-group input-group-sm">
                        <input type="number" class="form-control input-peso" placeholder="0" value="${pesoPrevio}" 
                               onchange="guardarProgreso(${fila.id}, ${fila.ejercicio_id}, 'peso', this.value)">
                        <span class="input-group-text bg-dark text-secondary border-secondary">kg</span>
                    </div>
                </div>
                <div class="col-3 text-end">
                    <input type="checkbox" class="form-check-input border-secondary bg-dark" style="width: 28px; height: 28px;"
                           ${estaCompletado} onchange="guardarProgreso(${fila.id}, ${fila.ejercicio_id}, 'check', this.checked)">
                </div>
            </div>
        `;
    });

    if (datosRutina.length > 0) html += `</div></div>`;
    contenedor.innerHTML = html;
}

// ==========================================
//      5. GUARDADO (BACKEND) - NUEVA LOGICA
// ==========================================

async function guardarProgreso(detalleId, ejercicioId, tipo, valor) {
    console.log("Guardando...", { detalleId, ejercicioId, tipo, valor });
    
    const { data: { user } } = await clienteSupabase.auth.getUser();
    const hoy = obtenerFechaLocal(); 

    const datosUpsert = {
        usuario_id: user.id,
        ejercicio_id: ejercicioId, // <--- Clave: Guardamos el ID del Ejercicio
        fecha_entrenamiento: hoy
    };

    // Intentamos guardar la referencia a la rutina actual, pero si falla (porque se borró), no importa
    if (detalleId) datosUpsert.rutina_detalle_id = detalleId;

    if (tipo === 'peso') datosUpsert.peso_real = valor;
    if (tipo === 'check') datosUpsert.completado = valor;

    // Upsert usando la nueva clave única (usuario + ejercicio + fecha)
    const { error } = await clienteSupabase
        .from('historial_usuario')
        .upsert(datosUpsert, { onConflict: 'usuario_id, ejercicio_id, fecha_entrenamiento' });

    if (error) console.error("Error guardando:", error);
    else console.log("Guardado OK");
}

// INICIAR
verificarSesion();