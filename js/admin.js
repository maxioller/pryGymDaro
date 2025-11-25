// js/admin.js

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
    await clienteSupabase.auth.signOut();
    window.location.href = 'login.html';
});

// Cambio de Vistas (Tabs)
function cambiarVista(vista) {
    // 1. Ocultar TODAS las secciones
    document.getElementById('vista-ejercicios').classList.add('d-none');
    document.getElementById('vista-rutinas').classList.add('d-none');
    document.getElementById('vista-crear-rutina').classList.add('d-none');
    document.getElementById('vista-clientes').classList.add('d-none');

    // 2. Resetear estilos menú
    document.getElementById('btn-nav-ejercicios').className = 'nav-link text-white link-opacity-75-hover';
    document.getElementById('btn-nav-rutinas').className = 'nav-link text-white link-opacity-75-hover';
    document.getElementById('btn-nav-clientes').className = 'nav-link text-white link-opacity-75-hover';

    // 3. Mostrar selección
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
    }
}


// ==========================================
//      2. GESTIÓN DE EJERCICIOS (CRUD)
// ==========================================

let idEjercicioEnEdicion = null; // Variable para saber si estamos editando

async function cargarEjercicios() {
    const tbody = document.getElementById('tabla-ejercicios');
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
            <tr>
                <td>
                    <img src="${imgUrl}" class="thumb-ejercicio" alt="img" onerror="this.src='https://placehold.co/50x50/333/FFF?text=Error'">
                </td>
                <td class="fw-bold">${ej.nombre}</td>
                <td><span class="badge bg-secondary">${ej.grupo_muscular}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="prepararEdicionEjercicio(${ej.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarEjercicio(${ej.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
}

// Función para limpiar el modal cuando creamos uno nuevo
function limpiarModalEjercicio() {
    idEjercicioEnEdicion = null; // Modo Crear
    document.getElementById('form-nuevo-ejercicio').reset();
    // Cambiar título del modal (Opcional, si tienes un ID en el título)
    // document.querySelector('#modalNuevoEjercicio .modal-title').innerText = "Agregar Ejercicio";
}

// Función para cargar los datos en el modal al editar
async function prepararEdicionEjercicio(id) {
    // 1. Buscar datos
    const { data: ejercicio, error } = await clienteSupabase
        .from('ejercicios_catalogo')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return alert("Error al cargar el ejercicio");

    // 2. Llenar campos
    document.getElementById('nombreEjercicio').value = ejercicio.nombre;
    document.getElementById('grupoMuscular').value = ejercicio.grupo_muscular;
    document.getElementById('urlImagen').value = ejercicio.imagen_url || "";

    // 3. Setear estado de edición
    idEjercicioEnEdicion = id;

    // 4. Abrir Modal Manualmente
    const modalElement = document.getElementById('modalNuevoEjercicio');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// 3. ESCRIBIR: Guardar nuevo ejercicio (Con subida de archivos)
async function guardarEjercicio() {
    const nombre = document.getElementById('nombreEjercicio').value;
    const grupo = document.getElementById('grupoMuscular').value;
    const inputArchivo = document.getElementById('archivoImagen');
    let urlFinal = document.getElementById('urlImagen').value; // Por defecto, el texto

    if (!nombre) return alert("El nombre es obligatorio");

    // A. SI HAY UN ARCHIVO SELECCIONADO, LO SUBIMOS PRIMERO
    if (inputArchivo.files.length > 0) {
        const archivo = inputArchivo.files[0];
        
        // 1. Mostrar estado de carga
        const estado = document.getElementById('estado-subida');
        estado.classList.remove('d-none');
        
        // 2. Crear nombre único para el archivo (ej: 174859_press.gif)
        const extension = archivo.name.split('.').pop();
        const nombreArchivo = `${Date.now()}_${nombre.replace(/\s+/g, '')}.${extension}`;

        // 3. Subir a Supabase Storage
        const { data, error: errorSubida } = await clienteSupabase
            .storage
            .from('ejercicios') // Nombre de tu bucket
            .upload(nombreArchivo, archivo);

        if (errorSubida) {
            alert("Error al subir imagen: " + errorSubida.message);
            estado.classList.add('d-none');
            return;
        }

        // 4. Obtener la URL pública para guardarla en la BD
        const { data: urlData } = clienteSupabase
            .storage
            .from('ejercicios')
            .getPublicUrl(nombreArchivo);
            
        urlFinal = urlData.publicUrl;
        estado.classList.add('d-none');
    }

    // B. GUARDAR DATOS EN LA BASE DE DATOS
    // (Usamos la variable urlFinal, que tendrá el link de Supabase o el que pegaste)
    
    const { error } = await clienteSupabase
        .from('ejercicios_catalogo')
        .insert([{ 
            nombre: nombre, 
            grupo_muscular: grupo, 
            imagen_url: urlFinal 
        }]);

    if (error) {
        alert("Error al guardar en base de datos: " + error.message);
    } else {
        // Cerrar modal y limpiar
        const el = document.getElementById('modalNuevoEjercicio');
        const modal = bootstrap.Modal.getInstance(el); // Usamos la instancia existente
        if(modal) modal.hide();
        
        document.getElementById('form-nuevo-ejercicio').reset();
        cargarEjercicios();
    }
}

// 4. BORRAR: Función inteligente (Borra BD + Storage)
async function borrarEjercicio(id) {
    if (!confirm("¿Estás seguro de borrar este ejercicio?")) return;

    // PASO 1: OBTENER DATOS DEL EJERCICIO (Necesitamos la URL de la imagen)
    const { data: ejercicio, error: errorConsulta } = await clienteSupabase
        .from('ejercicios_catalogo')
        .select('imagen_url')
        .eq('id', id)
        .single();

    if (errorConsulta) {
        console.error("Error al buscar ejercicio:", errorConsulta);
        return alert("No se pudo localizar el ejercicio.");
    }

    // PASO 2: BORRAR LA IMAGEN DEL STORAGE (Solo si existe y es nuestra)
    if (ejercicio.imagen_url && ejercicio.imagen_url.includes('supabase')) {
        try {
            // La URL es tipo: .../storage/v1/object/public/ejercicios/17823_foto.jpg
            // Usamos .split('/').pop() para obtener solo "17823_foto.jpg"
            const nombreArchivo = ejercicio.imagen_url.split('/').pop();
            
            console.log("Borrando archivo de la nube:", nombreArchivo);
            
            const { error: errorStorage } = await clienteSupabase
                .storage
                .from('ejercicios')
                .remove([nombreArchivo]); // Supabase pide un array de nombres

            if (errorStorage) console.warn("No se pudo borrar el archivo del storage:", errorStorage);

        } catch (e) {
            console.error("Error procesando la imagen:", e);
        }
    }

    // PASO 3: BORRAR EL REGISTRO DE LA BASE DE DATOS
    const { error } = await clienteSupabase
        .from('ejercicios_catalogo')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Error al borrar de la base de datos: " + error.message);
    } else {
        // Éxito total
        cargarEjercicios();
    }
}


// ==========================================
//      3. GESTIÓN DE RUTINAS (LISTADO)
// ==========================================

async function cargarRutinas() {
    const tbody = document.getElementById('tabla-rutinas');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border text-warning"></div></td></tr>';

    const { data: rutinas, error } = await clienteSupabase
        .from('rutinas')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Error al cargar rutinas</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    if (rutinas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay rutinas creadas.</td></tr>';
        return;
    }

    rutinas.forEach(rutina => {
        const etiquetaTipo = rutina.es_plantilla 
            ? '<span class="badge bg-info text-dark">Plantilla</span>' 
            : '<span class="badge bg-secondary">Personalizada</span>';

        const fila = `
            <tr>
                <td class="fw-bold text-white">${rutina.nombre}</td>
                <td>${etiquetaTipo}</td>
                <td>${rutina.nivel_dias} días</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-info me-1" onclick="previsualizarRutina(${rutina.id})" title="Ver como cliente">
                        <i class="bi bi-eye"></i>
                    </button>

                    <button class="btn btn-sm btn-outline-warning me-1" onclick="editarRutina(${rutina.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="borrarRutina(${rutina.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
}

async function borrarRutina(id) {
    if (!confirm("¿Estás seguro de eliminar esta rutina? Se borrará también de los clientes asignados.")) return;

    const { error } = await clienteSupabase
        .from('rutinas')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Error al borrar: " + error.message);
    } else {
        cargarRutinas(); 
    }
}


// ==========================================
//      4. CONSTRUCTOR DE RUTINAS (LOGICA)
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

    // 1. Cargar Cabecera
    const { data: rutina, error: errorHeader } = await clienteSupabase
        .from('rutinas')
        .select('*')
        .eq('id', id)
        .single();

    if (errorHeader) {
        alert("Error al cargar la rutina");
        cambiarVista('rutinas');
        return;
    }

    document.getElementById('nombreNuevaRutina').value = rutina.nombre;
    document.getElementById('descripcionRutina').value = rutina.descripcion || "";

    // 2. Cargar Detalles
    const { data: detalles } = await clienteSupabase
        .from('rutinas_detalles')
        .select(`
            *,
            rutinas_dias!inner ( dia_numero ),
            ejercicios_catalogo ( nombre )
        `)
        .eq('rutinas_dias.rutina_id', id)
        .order('orden_ejercicio', { ascending: true });

    // 3. Reconstruir Objeto Temporal
    rutinaTemporal = { 
        nombre: rutina.nombre, 
        dias: {}, 
        diaSeleccionado: 1 
    };

    if (detalles && detalles.length > 0) {
        detalles.forEach(d => {
            const numDia = d.rutinas_dias.dia_numero;
            
            if (!rutinaTemporal.dias[numDia]) {
                rutinaTemporal.dias[numDia] = [];
            }

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

    const maxDia = Object.keys(rutinaTemporal.dias).length > 0 
        ? Math.max(...Object.keys(rutinaTemporal.dias).map(Number)) 
        : 1;
        
    rutinaTemporal.diaSeleccionado = 1; // Ir al día 1 por defecto
    
    renderizarTabs(); 
    cargarCatalogoLateral();
    renderizarDiaActual();
    
    btnGuardar.innerHTML = '<i class="bi bi-pencil-square me-1"></i> Actualizar Rutina';
    btnGuardar.disabled = false;
}


// --- Helpers del Constructor ---
async function cargarCatalogoLateral() {
    const contenedor = document.getElementById('lista-catalogo-lateral');
    const { data: ejercicios } = await clienteSupabase
        .from('ejercicios_catalogo')
        .select('*')
        .order('nombre');

    window.todosLosEjercicios = ejercicios;
    dibujarCatalogo(ejercicios);
}

function dibujarCatalogo(lista) {
    const contenedor = document.getElementById('lista-catalogo-lateral');
    contenedor.innerHTML = "";
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
            </div>
        `;
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

    if (!rutinaTemporal.dias[rutinaTemporal.diaSeleccionado]) {
        rutinaTemporal.dias[rutinaTemporal.diaSeleccionado] = [];
    }
    rutinaTemporal.dias[rutinaTemporal.diaSeleccionado].push(nuevoItem);
    renderizarDiaActual();
}

function renderizarDiaActual() {
    const contenedor = document.getElementById('contenedor-rutina-builder');
    const dia = rutinaTemporal.diaSeleccionado;
    const ejerciciosDelDia = rutinaTemporal.dias[dia] || [];

    const spanDia = document.getElementById('span-dia-actual');
    if (spanDia) spanDia.innerText = dia;

    if (ejerciciosDelDia.length === 0) {
        contenedor.innerHTML = `<p class="text-muted text-center mt-5">
            <i class="bi bi-arrow-left-circle fs-1 d-block mb-2"></i>
            Selecciona ejercicios del menú izquierdo para agregarlos al Día <span id="span-dia-actual">${dia}</span>
        </p>`;
        return;
    }

    contenedor.innerHTML = "";

    ejerciciosDelDia.forEach((item, index) => {
        const selTrabajo = item.tipo === 'trabajo' ? 'selected' : '';
        const selCalentamiento = item.tipo === 'calentamiento' ? 'selected' : '';
        const selFallo = item.tipo === 'fallo' ? 'selected' : '';
        const colorBorde = item.tipo === 'calentamiento' ? '#6c757d' : '#ffc107';

        const html = `
            <div class="item-rutina p-3 mb-3 rounded shadow-sm animate__animated animate__fadeIn" 
                 style="border-left: 4px solid ${colorBorde}">
                
                <div class="d-flex justify-content-between mb-2">
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-dark border border-secondary rounded-circle">${index + 1}</span>
                        <h6 class="fw-bold text-white mb-0">${item.nombre}</h6>
                    </div>
                    <button class="btn btn-sm btn-outline-danger border-0 py-0" onclick="eliminarItem(${item.id_temp})">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                
                <div class="row g-2">
                    <div class="col-3">
                        <label class="small text-secondary" style="font-size: 0.7rem;">TIPO</label>
                        <select class="form-select input-compacto p-1" 
                                onchange="actualizarItem(${item.id_temp}, 'tipo', this.value); renderizarDiaActual();">
                            <option value="trabajo" ${selTrabajo}>Trabajo</option>
                            <option value="calentamiento" ${selCalentamiento}>Calentamiento</option>
                            <option value="fallo" ${selFallo}>Al Fallo</option>
                        </select>
                    </div>
                    <div class="col-2">
                        <label class="small text-secondary" style="font-size: 0.7rem;">SERIES</label>
                        <input type="text" class="form-control input-compacto text-center" value="${item.series}" 
                            onchange="actualizarItem(${item.id_temp}, 'series', this.value)">
                    </div>
                    <div class="col-2">
                        <label class="small text-secondary" style="font-size: 0.7rem;">REPS</label>
                        <input type="text" class="form-control input-compacto text-center" value="${item.reps}" 
                            onchange="actualizarItem(${item.id_temp}, 'reps', this.value)">
                    </div>
                    <div class="col-5">
                        <label class="small text-secondary" style="font-size: 0.7rem;">NOTA / PAUSA</label>
                        <input type="text" class="form-control input-compacto" value="${item.nota}" placeholder="Ej: 75%"
                            onchange="actualizarItem(${item.id_temp}, 'nota', this.value)">
                    </div>
                </div>
            </div>
        `;
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
        
        contenedor.innerHTML += `
            <button type="button" class="btn ${clase}" onclick="seleccionarDia(${i})">
                Día ${i}
            </button>`;
    }

    contenedor.innerHTML += `
        <button type="button" class="btn btn-outline-secondary" onclick="agregarDia()">
            + Día
        </button>`;

    if (totalDias > 1) {
        contenedor.innerHTML += `
            <button type="button" class="btn btn-outline-danger ms-2" onclick="eliminarDiaActual()" title="Eliminar el Día ${diaActual}">
                <i class="bi bi-trash"></i>
            </button>`;
    }
}

function eliminarDiaActual() {
    const diaActual = rutinaTemporal.diaSeleccionado;
    const totalDias = Object.keys(rutinaTemporal.dias).length;

    if (totalDias <= 1) return alert("La rutina debe tener al menos un día.");
    if (!confirm(`¿Estás seguro de eliminar el DÍA ${diaActual} y todos sus ejercicios?`)) return;

    const nuevosDias = {};
    let contador = 1;

    for (let i = 1; i <= totalDias; i++) {
        if (i !== diaActual) {
            nuevosDias[contador] = rutinaTemporal.dias[i];
            contador++;
        }
    }

    rutinaTemporal.dias = nuevosDias;

    if (diaActual > Object.keys(nuevosDias).length) {
        rutinaTemporal.diaSeleccionado = diaActual - 1;
    }

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


// ==========================================
//      5. GUARDAR RUTINA
// ==========================================

async function guardarRutinaCompleta() {
    const nombre = document.getElementById('nombreNuevaRutina').value;
    const descripcion = document.getElementById('descripcionRutina').value;

    if (!nombre) return alert("Por favor, ponle un nombre a la rutina.");
    
    const diasConEjercicios = Object.values(rutinaTemporal.dias).some(lista => lista.length > 0);
    if (!diasConEjercicios) return alert("La rutina está vacía.");

    const btnGuardar = document.querySelector('#vista-crear-rutina .btn-success');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Guardando...';
    btnGuardar.disabled = true;

    try {
        const { data: { user } } = await clienteSupabase.auth.getUser();
        let rutinaId = idRutinaEnEdicion; 

        if (rutinaId) {
            // === MODO UPDATE ===
            await clienteSupabase.from('rutinas')
                .update({ 
                    nombre: nombre, 
                    descripcion: descripcion,
                    nivel_dias: Object.keys(rutinaTemporal.dias).length 
                })
                .eq('id', rutinaId);

            // Borrar datos viejos
            const { data: diasViejos } = await clienteSupabase.from('rutinas_dias').select('id').eq('rutina_id', rutinaId);
            if (diasViejos.length > 0) {
                const ids = diasViejos.map(d => d.id);
                await clienteSupabase.from('rutinas_detalles').delete().in('dia_id', ids);
                await clienteSupabase.from('rutinas_dias').delete().eq('rutina_id', rutinaId);
            }

        } else {
            // === MODO INSERT ===
            const { data: nueva, error } = await clienteSupabase
                .from('rutinas')
                .insert([{
                    nombre: nombre,
                    descripcion: descripcion,
                    es_plantilla: true,
                    creador_id: user.id,
                    nivel_dias: Object.keys(rutinaTemporal.dias).length,
                    genero_objetivo: 'mixto'
                }])
                .select().single();
            
            if(error) throw error;
            rutinaId = nueva.id;
        }

        // === INSERTAR CONTENIDO ===
        for (const numDia of Object.keys(rutinaTemporal.dias)) {
            const ejerciciosDelDia = rutinaTemporal.dias[numDia];
            if (ejerciciosDelDia.length === 0) continue;

            const { data: diaCreado, error: errorDia } = await clienteSupabase
                .from('rutinas_dias')
                .insert([{
                    rutina_id: rutinaId,
                    dia_numero: parseInt(numDia),
                    grupo_muscular_objetivo: 'General'
                }])
                .select().single();

            if (errorDia) throw errorDia;
            const diaId = diaCreado.id;

            let filasParaInsertar = [];
            let contadorEjercicio = 0; 
            let ultimoEjercicioId = null;
            let contadorSerie = 1;

            ejerciciosDelDia.forEach((item) => {
                if (item.ejercicio_id !== ultimoEjercicioId) {
                    contadorEjercicio++; 
                    contadorSerie = 1;   
                    ultimoEjercicioId = item.ejercicio_id;
                } 

                const cantidadSeries = parseInt(item.series) || 1;

                for (let i = 0; i < cantidadSeries; i++) {
                    filasParaInsertar.push({
                        dia_id: diaId,
                        ejercicio_id: item.ejercicio_id,
                        orden_ejercicio: contadorEjercicio, 
                        orden_serie: contadorSerie, 
                        tipo_serie: item.tipo, 
                        series_objetivo: item.series, 
                        reps_objetivo: item.reps,
                        observaciones: item.nota,
                        descanso_info: 'N/A' 
                    });
                    contadorSerie++; 
                }
            });

            const { error: errorDetalles } = await clienteSupabase
                .from('rutinas_detalles')
                .insert(filasParaInsertar);

            if (errorDetalles) throw errorDetalles;
        }

        alert(rutinaId ? "¡Rutina actualizada!" : "¡Rutina creada!");
        abrirConstructor(); 
        cambiarVista('rutinas');

    } catch (error) {
        console.error("Error:", error);
        alert("Hubo un error. Revisa la consola.");
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
}

// ==========================================
//      MÓDULO 4: GESTIÓN DE CLIENTES
// ==========================================

async function cargarClientes() {
    const tbody = document.getElementById('tabla-clientes');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5"><div class="spinner-border text-warning"></div></td></tr>';

    const { data: clientes, error } = await clienteSupabase
        .from('perfiles')
        .select('*')
        .eq('rol', 'cliente');

    if (error) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-danger text-center">Error al cargar clientes</td></tr>';
        return;
    }

    const { data: asignaciones } = await clienteSupabase
        .from('asignaciones_rutinas')
        .select('cliente_id, rutinas(nombre)')
        .eq('activa', true);

    tbody.innerHTML = '';

    clientes.forEach(cliente => {
        const asignacion = asignaciones.find(a => a.cliente_id === cliente.id);
        const nombreRutina = asignacion ? asignacion.rutinas.nombre : '<span class="text-muted fst-italic">Sin asignar</span>';
        const badge = asignacion ? '<span class="badge bg-success">Activa</span>' : '<span class="badge bg-secondary">Inactiva</span>';

        const fila = `
            <tr>
                <td class="fw-bold text-white">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-secondary d-flex justify-content-center align-items-center me-2 small" style="width: 30px; height: 30px;">
                            ${cliente.nombre.charAt(0).toUpperCase()}
                        </div>
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
                    <button class="btn btn-sm btn-warning fw-bold" onclick="abrirModalAsignar('${cliente.id}', '${cliente.nombre}')">
                        Asignar Rutina
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
}

async function abrirModalAsignar(clienteId, nombreCliente) {
    document.getElementById('idClienteAsignar').value = clienteId;
    document.getElementById('nombreClienteAsignar').innerText = nombreCliente;

    const select = document.getElementById('selectRutinaAsignar');
    select.innerHTML = '<option>Cargando...</option>';

    const { data: rutinas, error } = await clienteSupabase
        .from('rutinas')
        .select('id, nombre')
        .eq('es_plantilla', true)
        .order('nombre');

    if (error) {
        console.error("Fallo RLS/Carga de Rutinas:", error);
        select.innerHTML = `<option>ERROR: No se cargaron rutinas.</option>`;
        return;
    }

    select.innerHTML = '';
    if (rutinas.length === 0) {
        select.innerHTML = `<option value="">-- No hay plantillas creadas --</option>`;
    } else {
        rutinas.forEach(r => {
            select.innerHTML += `<option value="${r.id}">${r.nombre}</option>`;
        });
    }

    const modalElement = document.getElementById('modalAsignar');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

async function guardarAsignacion() {
    const clienteId = document.getElementById('idClienteAsignar').value;
    const rutinaId = document.getElementById('selectRutinaAsignar').value;

    if (!rutinaId) return alert("Selecciona una rutina");

    await clienteSupabase
        .from('asignaciones_rutinas')
        .update({ activa: false })
        .eq('cliente_id', clienteId);

    const { error } = await clienteSupabase
        .from('asignaciones_rutinas')
        .insert([{
            cliente_id: clienteId,
            rutina_id: rutinaId,
            activa: true
        }]);

    if (error) {
        alert("Error al asignar: " + error.message);
    } else {
        alert("¡Rutina asignada con éxito!");
        const modalElement = document.getElementById('modalAsignar');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        modalInstance.hide();
        cargarClientes();
    }
}

// ==========================================
//      MÓDULO 5: PREVISUALIZACIÓN
// ==========================================

let datosPreviewGlobal = {}; 

async function previsualizarRutina(id) {
    const modal = new bootstrap.Modal(document.getElementById('modalPrevisualizar'));
    modal.show();
    document.getElementById('contenido-preview').innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div></div>';
    
    const { data: detalles, error } = await clienteSupabase
        .from('rutinas_detalles')
        .select(`
            *,
            rutinas_dias!inner ( dia_numero, rutina_id, rutinas ( nombre, descripcion ) ),
            ejercicios_catalogo ( nombre, imagen_url )
        `)
        .eq('rutinas_dias.rutina_id', id)
        .order('orden_ejercicio', { ascending: true })
        .order('orden_serie', { ascending: true });

    if (error || detalles.length === 0) {
        document.getElementById('contenido-preview').innerHTML = '<p class="text-center text-danger">No se pudo cargar la rutina o está vacía.</p>';
        return;
    }

    const infoRutina = detalles[0].rutinas_dias.rutinas;
    document.getElementById('tituloPreview').innerText = infoRutina.nombre;
    document.getElementById('descPreview').innerText = infoRutina.descripcion || "Sin descripción";

    datosPreviewGlobal = {}; 
    
    detalles.forEach(d => {
        const numDia = d.rutinas_dias.dia_numero;
        if (!datosPreviewGlobal[numDia]) datosPreviewGlobal[numDia] = [];
        datosPreviewGlobal[numDia].push(d);
    });

    const contenedorTabs = document.getElementById('tabs-dias-preview');
    contenedorTabs.innerHTML = '';
    const diasDisponibles = Object.keys(datosPreviewGlobal).sort();

    diasDisponibles.forEach((dia, index) => {
        const btn = document.createElement('button');
        const clase = index === 0 ? 'btn-warning fw-bold' : 'btn-outline-secondary'; 
        btn.className = `btn ${clase} btn-sm`;
        btn.innerText = `Día ${dia}`;
        btn.onclick = () => renderizarDiaPreview(dia);
        contenedorTabs.appendChild(btn);
    });

    renderizarDiaPreview(diasDisponibles[0]);
}

function renderizarDiaPreview(dia) {
    const tabs = document.getElementById('tabs-dias-preview').children;
    for (let btn of tabs) {
        if (btn.innerText === `Día ${dia}`) {
            btn.className = 'btn btn-warning fw-bold btn-sm';
        } else {
            btn.className = 'btn btn-outline-secondary btn-sm';
        }
    }

    const contenedor = document.getElementById('contenido-preview');
    const ejercicios = datosPreviewGlobal[dia];
    contenedor.innerHTML = '';

    let tarjetaActualIdx = null;
    let html = '';

    ejercicios.forEach(fila => {
        
        const esNuevaTarjeta = fila.orden_ejercicio !== tarjetaActualIdx;
        
        if (esNuevaTarjeta) {
            if (tarjetaActualIdx !== null) html += `</div></div>`; 
            tarjetaActualIdx = fila.orden_ejercicio;

            const img = fila.ejercicios_catalogo.imagen_url 
                ? `<div class="text-center mb-3"><img src="${fila.ejercicios_catalogo.imagen_url}" class="img-fluid rounded" style="max-height: 150px;" onerror="this.style.display='none'"></div>` 
                : '';

            html += `
                <div class="card-preview p-3 animate__animated animate__fadeIn">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h5 class="m-0 text-white">${fila.ejercicios_catalogo.nombre}</h5>
                        <span class="badge-preview">#${fila.orden_ejercicio}</span>
                    </div>
                    ${img}
                    <div class="lista-series">
            `;
        }

        const badgeClass = fila.tipo_serie === 'calentamiento' ? 'bg-secondary' : 'bg-success';
        const textoTipo = fila.tipo_serie ? fila.tipo_serie.toUpperCase() : 'TRABAJO';
        const notaSerie = fila.observaciones ? `<div class="text-warning small fst-italic">${fila.observaciones}</div>` : '';

        html += `
            <div class="fila-serie-preview row align-items-center text-white">
                <div class="col-6">
                    <span class="badge ${badgeClass} mb-1" style="font-size: 0.6rem;">${textoTipo}</span>
                    <div class="fw-bold">${fila.reps_objetivo} <span class="text-muted fw-normal">reps</span></div>
                    ${notaSerie}
                </div>
                <div class="col-6 text-end">
                    <span class="text-muted small me-2">${fila.descanso_info || ''}</span>
                    <div class="input-fake">kg</div>
                    <input type="checkbox" disabled class="form-check-input bg-dark border-secondary ms-2">
                </div>
            </div>
        `;
    });

    if (ejercicios.length > 0) html += `</div></div>`;
    contenedor.innerHTML = html;
}


// ==========================================
//      INICIO SEGURO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    verificarAdmin();
});