// js/config.js
// Este archivo se encarga SOLO de iniciar la conexión con Supabase.
// Así, si mañana cambias de proyecto, solo cambias las claves aquí.

const SUPABASE_URL = 'https://nbefapbazrhdfezcfkqz.supabase.co'; // Pega tu URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZWZhcGJhenJoZGZlemNma3F6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTY1MjQsImV4cCI6MjA3OTU3MjUyNH0.tgTXG6eTY9rm2Q4JNMA1BSyyvleLNe5XsSYxKnebs8I'; // Pega tu Key larga

// Creamos la variable global 'clienteSupabase' para que la usen los otros archivos
const clienteSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("✅ Conexión con Supabase inicializada");