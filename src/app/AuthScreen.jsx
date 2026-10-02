import { useState } from 'react'
import { authRedirectUrl, supabase } from '../lib/supabase'
import logo from '../assets/vh-logo.svg'

function recoveryErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('rate limit') || message.includes('too many') || message.includes('after')) return 'Muitas tentativas de recuperação foram feitas recentemente. Aguarde alguns minutos e solicite um novo e-mail.'
  if (message.includes('redirect') || message.includes('url')) return 'O endereço de recuperação não está autorizado no Supabase. Atualize a página publicada e tente novamente.'
  if (message.includes('smtp') || message.includes('email')) return 'O Supabase não conseguiu enviar o e-mail agora. Verifique o provedor de e-mail e tente novamente em alguns minutos.'
  return 'Não foi possível solicitar a redefinição agora. Tente novamente em alguns minutos.'
}

export function AuthScreen({ configurationError = '', initialError = '' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState('')

  async function signIn(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setError('Não foi possível entrar. Confira o e-mail, a senha e se o e-mail foi confirmado.')
      setBusy(false)
      return
    }

    setBusy(false)
  }

  async function sendRecovery() {
    setError('')
    setNotice('')
    if (!email.trim()) {
      setError('Informe o e-mail da conta master para receber a recuperação.')
      return
    }
    setBusy(true)
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl })
    setBusy(false)
    if (recoveryError) {
      console.error('Falha na recuperação de senha:', recoveryError)
      setError(recoveryErrorMessage(recoveryError))
    }
    else setNotice('Se o e-mail estiver autorizado, enviaremos as instruções de recuperação.')
  }

  return (
    <main className="auth-layout">
      <section className="auth-brand-panel">
        <div><div className="logo-lockup brand-logo-lockup"><img className="brand-logo-image" src={logo} alt="VH Imports — tênis importados" /></div><p className="brand-kicker">sneakers · controle interno</p></div>
        <div className="brand-message"><p className="eyebrow">Tênis importados, organização</p><h1>Um olhar claro para cada venda.</h1><p>Controle pedidos, estoque, recebimentos e cobranças da sua loja online em um só lugar.</p></div>
        <span className="brand-footer">Acesso restrito aos dois usuários master</span>
      </section>
      <section className="auth-form-panel"><div className="auth-card">
        <span className="eyebrow">Área reservada</span>
        <h2>Entrar no sistema</h2>
        <p className="auth-help">Use uma das contas master autorizadas para continuar.</p>
        {configurationError && <div className="alert warning"><strong>Ambiente ainda não conectado</strong><span>{configurationError}</span></div>}
        {error && <div className="alert error"><strong>Não foi possível continuar</strong><span>{error}</span></div>}
        {notice && <div className="alert success"><strong>Pronto</strong><span>{notice}</span></div>}

        {!configurationError && <form onSubmit={signIn} className="auth-form"><label>E-mail<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu e-mail autorizado" required /></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" minLength="12" required /></label><button className="primary-button" disabled={busy}>{busy ? 'Validando…' : 'Entrar no sistema'}</button><button type="button" className="text-button" onClick={sendRecovery} disabled={busy}>Esqueci minha senha</button></form>}
        <p className="security-note"><span className="shield-icon">◆</span> Sessão protegida por senha e confirmação de e-mail.</p>
      </div></section>
    </main>
  )
}
