import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../assets/vh-logo.svg'

export function PasswordSetupScreen() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 12) return setError('A senha precisa ter pelo menos 12 caracteres.')
    if (password !== confirmation) return setError('As senhas não coincidem.')
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Não foi possível definir a senha. O convite pode ter expirado; solicite um novo.')
      setBusy(false)
      return
    }
    window.history.replaceState({}, document.title, window.location.pathname)
    setDone(true)
    await supabase.auth.signOut()
    setBusy(false)
  }

  return <main className="auth-layout">
    <section className="auth-brand-panel"><div><div className="logo-lockup brand-logo-lockup"><img className="brand-logo-image" src={logo} alt="VH Imports — tênis importados" /></div><p className="brand-kicker">sneakers · controle interno</p></div><div className="brand-message"><p className="eyebrow">Primeiro acesso</p><h1>Seu espaço começa aqui.</h1><p>Defina uma senha pessoal para concluir o convite da sua conta master.</p></div><span className="brand-footer">Acesso restrito aos dois usuários master</span></section>
    <section className="auth-form-panel"><div className="auth-card"><span className="eyebrow">Convite confirmado</span><h2>{done ? 'Senha definida' : 'Defina sua senha'}</h2><p className="auth-help">{done ? 'Agora você já pode voltar à tela de login e ativar o autenticador.' : 'Use uma senha pessoal com no mínimo 12 caracteres. Não compartilhe sua senha.'}</p>{error && <div className="alert error"><strong>Não foi possível continuar</strong><span>{error}</span></div>}{done ? <button className="primary-button" onClick={() => window.location.assign(window.location.pathname)}>Ir para o login</button> : <form onSubmit={submit} className="auth-form"><label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="12" required /></label><label>Confirmar senha<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength="12" required /></label><button className="primary-button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar senha'}</button></form>}<p className="security-note"><span className="shield-icon">◆</span> Sua senha não é armazenada no frontend.</p></div></section>
  </main>
}

