import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('coloque_'))
export const authRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || 'https://vhimports.github.io/vhimports/painel.html'

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // A sessão não deve sobreviver a reload/back-forward do navegador.
        // Enquanto a aba permanecer aberta, o Supabase ainda pode renovar o token.
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function configurationMessage() {
  return 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente local para conectar o sistema.'
}
