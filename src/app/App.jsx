import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured, configurationMessage } from '../lib/supabase'
import { AuthScreen } from './AuthScreen'
import { Dashboard } from './Dashboard'
import { PasswordSetupScreen } from './PasswordSetupScreen'
import logo from '../assets/vh-logo.svg'

export default function App() {
  const [session, setSession] = useState(null)
  const [setupSession, setSetupSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let active = true
    function handlePageShow(event) {
      // Browsers podem restaurar a aplicação pelo bfcache ao usar Voltar.
      // Limpar a sessão nesse retorno força uma nova autenticação.
      if (event.persisted) void supabase.auth.signOut({ scope: 'local' })
    }
    window.addEventListener('pageshow', handlePageShow)
    const setupFlow = /(?:^|&)type=(?:invite|recovery)(?:&|$)/.test(window.location.hash.replace(/^#/, ''))
    async function gateSession(nextSession) {
      if (!nextSession) {
        if (active) {
          setSession(null)
          setSetupSession(null)
        }
        return
      }
      if (setupFlow) {
        setSetupSession(nextSession)
        setSession(null)
        return
      }
      // O acesso operacional usa senha, e-mail confirmado, master ativo e sessão válida.
      // MFA foi desativado; a autorização final continua sendo feita pelo RLS/RPCs.
      setSession(nextSession)
    }

    async function hydrate() {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return
      if (error) setAuthError(error.message)
      await gateSession(data.session)
      if (active) setLoading(false)
    }
    hydrate()

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Evita executar outra chamada Auth dentro do callback síncrono do Supabase.
      window.setTimeout(() => gateSession(nextSession).finally(() => active && setLoading(false)), 0)
    })

    return () => {
      active = false
      window.removeEventListener('pageshow', handlePageShow)
      data.subscription.unsubscribe()
    }
  }, [])

  const configIssue = useMemo(() => !isSupabaseConfigured, [])

  if (loading) return <div className="loading-screen"><img className="loading-logo" src={logo} alt="VH Imports — tênis importados" /><p>Carregando VH Imports…</p></div>
  if (configIssue) return <AuthScreen configurationError={configurationMessage()} />
  if (setupSession) return <PasswordSetupScreen />
  if (!session) return <AuthScreen initialError={authError} />
  return <Dashboard session={session} />
}

