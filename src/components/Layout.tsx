import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Layout() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { user, signOut } = useAuth()
  const [hasOverdue, setHasOverdue] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const emailLabel = user?.email ?? ''
  const inicial    = emailLabel.charAt(0).toUpperCase()

  useEffect(() => {
    supabase
      .from('contas_a_receber')
      .select('id', { count: 'exact', head: true })
      .eq('vencida', true)
      .then(({ count }) => setHasOverdue((count ?? 0) > 0))
  }, [location.pathname])

  return (
    <>
      <header style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1a1040 100%)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
      }}>
        <div style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '0 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          height: 58,
        }}>
          {/* Brand */}
          <div style={{
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: 15,
            color: '#fff',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}>
            Sistema de Gestão de Leilão
            <span style={{
              marginLeft: 8,
              fontWeight: 700,
              fontSize: 12,
              color: 'rgba(165,180,252,0.9)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.35)',
              borderRadius: 6,
              padding: '2px 7px',
            }}>
              GFB
            </span>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

          {/* Nav tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <NavLink to="/" end style={tabStyle}>Dashboard</NavLink>
            <NavLink to="/lotes" style={tabStyle}>Lotes</NavLink>
            <NavLink to="/contas" style={tabStyle}>
              {({ isActive }) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Contas a receber
                  {hasOverdue && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#f87171', display: 'inline-block',
                      flexShrink: 0,
                    }} />
                  )}
                  {isActive && null}
                </span>
              )}
            </NavLink>
          </nav>

          <div style={{ flex: 1 }} />

          {/* Avatar + sair */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {emailLabel}
            </span>
            <span style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              display: 'grid', placeItems: 'center',
              fontWeight: 700, fontSize: 13,
              boxShadow: '0 0 0 2px rgba(99,102,241,0.4)',
              flexShrink: 0,
            }}>{inicial}</span>
            <button
              onClick={handleSignOut}
              title="Sair"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(220,38,38,0.2)'; (e.target as HTMLButtonElement).style.color = '#fca5a5' }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)' }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: 22 }}>
        <Outlet />
      </main>
    </>
  )
}

function tabStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    padding: '6px 14px',
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: "'Outfit', system-ui, sans-serif",
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
    borderRadius: 8,
    color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
    background: isActive ? 'rgba(165,180,252,0.15)' : 'transparent',
    transition: 'background 0.15s, color 0.15s',
  }
}
