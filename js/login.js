// js/login.js

let esRegistro = false; // Estado inicial: Login

const formulario = document.getElementById('form-login');
// Nota: Ya no necesitamos el elemento 'mensaje-feedback' para mostrar errores, 
// pero lo dejo declarado por si lo usas en otra cosa, aunque SweetAlert lo reemplaza.
const mensajeFeedback = document.getElementById('mensaje-feedback');

// Función para cambiar entre Login y Registro
function alternarModo() {
    esRegistro = !esRegistro;
    if(mensajeFeedback) mensajeFeedback.classList.add('d-none'); // Limpiar errores viejos si quedan

    if (esRegistro) {
        // MODO REGISTRO
        document.getElementById('titulo-form').innerText = "Crear Cuenta";
        document.getElementById('subtitulo-form').innerText = "Únete a nosotros";
        document.getElementById('campo-nombre').classList.remove('d-none'); // Mostrar nombre
        document.getElementById('nombre').setAttribute('required', 'true'); // Hacerlo obligatorio
        document.getElementById('btn-texto').innerText = "REGISTRARSE";
        
        document.getElementById('texto-toggle').innerText = "¿Ya tienes cuenta?";
        document.getElementById('link-toggle').innerText = "Iniciar Sesión";
    } else {
        // MODO LOGIN
        document.getElementById('titulo-form').innerText = "Bienvenido";
        document.getElementById('subtitulo-form').innerText = "Ingresa tus credenciales";
        document.getElementById('campo-nombre').classList.add('d-none'); // Ocultar nombre
        document.getElementById('nombre').removeAttribute('required');
        document.getElementById('btn-texto').innerText = "INGRESAR";
        
        document.getElementById('texto-toggle').innerText = "¿No tienes cuenta?";
        document.getElementById('link-toggle').innerText = "Crear una cuenta";
    }
}

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();

    // UI Loading
    const btnTexto = document.getElementById('btn-texto');
    const btnSpinner = document.getElementById('btn-spinner');
    
    btnTexto.classList.add('d-none');
    btnSpinner.classList.remove('d-none');
    if(mensajeFeedback) mensajeFeedback.classList.add('d-none');

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const nombre = document.getElementById('nombre').value;

    try {
        if (esRegistro) {
            // === LOGICA DE REGISTRO ===
            const { data, error } = await clienteSupabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    // Esto es CRUCIAL: Pasamos el nombre para que el Trigger lo capture
                    data: {
                        full_name: nombre 
                    }
                }
            });

            if (error) throw error;

            // EXITO EN REGISTRO (CON SWEETALERT)
            Toast.fire({
                icon: 'success',
                title: '¡Bienvenido!',
                text: 'Cuenta creada con éxito. Redirigiendo...'
            });
            
            // Volvemos al modo login automáticamente después de 2 segundos
            setTimeout(() => {
                alternarModo();
                document.getElementById('email').value = email; // Dejamos el email puesto
                document.getElementById('password').value = "";
            }, 2000);

        } else {
            // === LOGICA DE LOGIN ===
            const { data, error } = await clienteSupabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Verificar Rol y Redirigir
            const userId = data.user.id;
            const { data: perfil, error: errorPerfil } = await clienteSupabase
                .from('perfiles')
                .select('rol')
                .eq('id', userId)
                .single();

            if (errorPerfil) throw errorPerfil;

            // Toast opcional de bienvenida al loguearse
            Toast.fire({
                icon: 'success',
                title: 'Sesión iniciada'
            });

            // Pequeña demora para que se vea el Toast antes de cambiar de página
            setTimeout(() => {
                if (perfil.rol === 'entrenador') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'app.html';
                }
            }, 1000);
        }

    } catch (error) {
        console.error(error);
        
        // ERROR GENERAL (CON SWEETALERT)
        Toast.fire({
            icon: 'error',
            title: 'Ups, algo falló',
            text: error.message || "Ocurrió un error inesperado."
        });

    } finally {
        // Restaurar botones
        btnTexto.classList.remove('d-none');
        btnSpinner.classList.add('d-none');
    }
});

// Función para iniciar sesión con Google
async function loginConGoogle() {
    const { data, error } = await clienteSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/app.html' 
        }
    });

    if (error) {
        console.error("Error Google:", error);
        
        // ERROR GOOGLE (CON SWEETALERT)
        Toast.fire({
            icon: 'error',
            title: 'Error de acceso',
            text: error.message || 'No se pudo conectar con Google'
        });
    }
}