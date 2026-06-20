import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [email,   setEmail]   = useState('')
  const [senha,   setSenha]   = useState('')
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState<string | null>(null)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !senha) return
    setLoading(true)
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    setLoading(false)
    if (error) {
      setErro('E-mail ou senha incorretos.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1a1040 60%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
            marginBottom: 16,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.02em' }}>
            Sistema de Gestão de Leilão
          </div>
          <div style={{ fontSize: 13, color: 'rgba(165,180,252,0.7)', marginTop: 4, fontWeight: 500 }}>
            GFB — acesso restrito
          </div>
        </div>

        {/* Card */}
        <form onSubmit={entrar} style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20,
          padding: '28px 28px 24px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(203,213,225,0.9)', marginBottom: 7, letterSpacing: '0.03em' }}>
              E-MAIL
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                fontFamily: 'inherit',
                fontSize: 14,
                padding: '11px 14px',
                borderRadius: 12,
                border: '1.5px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.7)')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.13)')}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'rgba(203,213,225,0.9)', marginBottom: 7, letterSpacing: '0.03em' }}>
              SENHA
            </label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              style={{
                width: '100%',
                fontFamily: 'inherit',
                fontSize: 14,
                padding: '11px 14px',
                borderRadius: 12,
                border: '1.5px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.7)')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.13)')}
            />
          </div>

          {erro && (
            <div style={{
              fontSize: 13,
              color: '#fca5a5',
              background: 'rgba(220,38,38,0.12)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
            }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              padding: '12px',
              borderRadius: 12,
              border: 'none',
              background: loading
                ? 'rgba(99,102,241,0.5)'
                : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              cursor: loading ? 'default' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.45)',
              transition: 'all 0.15s',
              letterSpacing: '0.01em',
            }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
