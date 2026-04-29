// Em desenvolvimento com `npm run dev`, usamos prefixo /api para evitar conflito
// entre rotas SPA (ex.: /charges) e rotas de backend no proxy do Vite.
// Em produção, defina VITE_API_BASE_URL com a URL completa da API.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
