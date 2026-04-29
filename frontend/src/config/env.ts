// Em desenvolvimento com `npm run dev`, o proxy do Vite redireciona as chamadas
// para http://localhost:5000. O baseURL deve ser '' (mesmo origin) para que o
// proxy funcione. Em produção, defina VITE_API_BASE_URL com a URL completa.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
