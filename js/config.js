// js/config.js
// Este archivo se encarga SOLO de iniciar la conexión con Supabase.
// Así, si mañana cambias de proyecto, solo cambias las claves aquí.

const SUPABASE_URL = 'https://nbefapbazrhdfezcfkqz.supabase.co'; // Pega tu URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZWZhcGJhenJoZGZlemNma3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTY1MjQsImV4cCI6MjA3OTU3MjUyNH0.tgTXG6eTY9rm2Q4JNMA1BSyyvleLNe5XsSYxKnebs8I'; // Pega tu Key larga

// Creamos la variable global 'clienteSupabase' para que la usen los otros archivos
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("✅ Conexión con Supabase inicializada");

// 1. Configuración para TOASTS (Notificaciones pequeñas en la esquina)
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1e2126', // Tu color de tarjetas
    color: '#fff',         // Texto blanco
    iconColor: '#ffc107',  // Iconos amarillos
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

// 2. Configuración para POPUPS (Ventanas de confirmar borrar, etc)
const Popup = Swal.mixin({
    background: '#1e2126',
    color: '#fff',
    confirmButtonColor: '#ffc107', // Tu amarillo
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, confirmar',
    cancelButtonText: 'Cancelar',
    customClass: {
        confirmButton: 'btn btn-warning fw-bold text-dark mx-2',
        cancelButton: 'btn btn-outline-secondary mx-2'
    },
    buttonsStyling: false // Para usar tus clases Bootstrap
});