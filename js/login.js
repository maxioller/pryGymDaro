// js/login.js - CON RECUPERACIÓN DE CONTRASEÑA

let modo = 'login'; // 'login', 'registro', 'recuperacion'

const formulario = document.getElementById('form-login');
const mensajeFeedback = document.getElementById('mensaje-feedback');

// UI Elements
const titulo = document.getElementById('titulo-form');
const subtitulo = document.getElementById('subtitulo-form');
const campoNombre = document.getElementById('campo-nombre');
const campoPass = document.querySelector('input[type="password"]').parentElement; // Contenedor del password
const btnTexto = document.getElementById('btn-texto');
const textoToggle = document.getElementById('texto-toggle');
const linkToggle = document.getElementById('link-toggle');

// 1. Lógica para cambiar entre modos
function alternarModo() {
    // Si estamos en recuperación, volver a login es el comportamiento por defecto del toggle
    if (modo === 'recuperacion') {
        modo = 'login';
    } else {
        modo = (modo === 'login') ? 'registro' : 'login';
    }
    actualizarUI();
}

function activarRecuperacion() {
    modo = 'recuperacion';
    actualizarUI();
}

function actualizarUI() {
    // Limpiar errores
    if(mensajeFeedback) mensajeFeedback.classList.add('d-none');
    
    // Resetear campos visuales
    campoNombre.classList.add('d-none');
    campoPass.classList.remove('d-none'); // Mostrar pass por defecto
    document.getElementById('nombre').removeAttribute('required');
    document.getElementById('password').setAttribute('required', 'true');

    if (modo === 'login') {
        titulo.innerText = "Bienvenido";
        subtitulo.innerText = "Ingresa tus credenciales";
        btnTexto.innerText = "INGRESAR";
        textoToggle.innerText = "¿No tienes cuenta?";
        linkToggle.innerText = "Crear una cuenta";
    } 
    else if (modo === 'registro') {
        titulo.innerText = "Crear Cuenta";
        subtitulo.innerText = "Únete a nosotros";
        campoNombre.classList.remove('d-none');
        document.getElementById('nombre').setAttribute('required', 'true');
        btnTexto.innerText = "REGISTRARSE";
        textoToggle.innerText = "¿Ya tienes cuenta?";
        linkToggle.innerText = "Iniciar Sesión";
    } 
    else if (modo === 'recuperacion') {
        titulo.innerText = "Recuperar Cuenta";
        subtitulo.innerText = "Te enviaremos un enlace mágico";
        campoPass.classList.add('d-none'); // Ocultar contraseña
        document.getElementById('password').removeAttribute('required');
        btnTexto.innerText = "ENVIAR ENLACE";
        textoToggle.innerText = "¿Ya te acordaste?";
        linkToggle.innerText = "Volver al Login";
    }
}

// 2. Manejo del Envío
formulario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btnSpinner = document.getElementById('btn-spinner');
    btnTexto.classList.add('d-none');
    btnSpinner.classList.remove('d-none');

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const nombre = document.getElementById('nombre').value;

    try {
        if (modo === 'registro') {
            // --- REGISTRO ---
            const { error } = await clienteSupabase.auth.signUp({
                email: email, password: password,
                options: { data: { full_name: nombre } }
            });
            if (error) throw error;
            Toast.fire({ icon: 'success', title: '¡Bienvenido!', text: 'Cuenta creada.' });
            setTimeout(() => { window.location.href = 'app.html'; }, 1500);

        } else if (modo === 'login') {
            // --- LOGIN ---
            const { data, error } = await clienteSupabase.auth.signInWithPassword({
                email: email, password: password,
            });
            if (error) throw error;

            const userId = data.user.id;
            const { data: perfil } = await clienteSupabase.from('perfiles').select('rol').eq('id', userId).single();
            
            Toast.fire({ icon: 'success', title: 'Sesión iniciada' });
            setTimeout(() => {
                if (perfil && perfil.rol === 'entrenador') window.location.href = 'admin.html';
                else window.location.href = 'app.html';
            }, 1000);

        } else if (modo === 'recuperacion') {
            // --- RECUPERACIÓN (NUEVO) ---
            const { error } = await clienteSupabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/app.html' // Redirige a la app
            });
            
            if (error) throw error;

            await Swal.fire({
                icon: 'success',
                title: 'Correo enviado',
                text: 'Revisa tu bandeja de entrada (y spam). Encontrarás un enlace para entrar y cambiar tu contraseña.',
                background: '#1e2126', color: '#fff', confirmButtonColor: '#ffc107', confirmButtonText: 'Entendido'
            });
            
            // Volver a login
            modo = 'login';
            actualizarUI();
        }

    } catch (error) {
        console.error(error);
        Toast.fire({ icon: 'error', title: 'Error', text: error.message || "Ocurrió un error." });
    } finally {
        btnTexto.classList.remove('d-none');
        btnSpinner.classList.add('d-none');
    }
});

// Google Login
async function loginConGoogle() {
    const { error } = await clienteSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/app.html' }
    });
    if (error) Toast.fire({ icon: 'error', title: 'Error Google', text: error.message });
}