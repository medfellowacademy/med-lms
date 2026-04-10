'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [setupMode, setSetupMode] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupResult, setSetupResult] = useState<{ email: string; password: string } | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      router.push(profile?.role === 'admin' ? '/admin/courses' : '/student')
    }

    setLoading(false)
  }

  async function handleSetup() {
    setSetupLoading(true)
    setError('')
    const res = await fetch('/api/setup', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Setup failed')
      setSetupLoading(false)
      return
    }

    setSetupResult({ email: data.email, password: data.password })
    setEmail(data.email)
    setPassword(data.password)
    setSetupMode(false)
    setSetupLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--teal)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px'
          }}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="white">
              <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11L3.5 14.5L5 9.5L1 6H6Z" />
            </svg>
          </div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: 'var(--teal)', marginBottom: 4 }}>
            MedFellow Academy
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Sign in to your account</p>
        </div>

        {/* Setup success banner */}
        {setupResult && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
            padding: '14px 16px', marginBottom: 16
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 6 }}>
              Admin account created!
            </p>
            <p style={{ fontSize: 12, color: '#166534', marginBottom: 4 }}>
              Email: <strong>{setupResult.email}</strong>
            </p>
            <p style={{ fontSize: 12, color: '#166534' }}>
              Password: <strong>{setupResult.password}</strong>
            </p>
            <p style={{ fontSize: 11, color: '#15803d', marginTop: 8, opacity: 0.8 }}>
              Credentials are pre-filled below. Click Sign In.
            </p>
          </div>
        )}

        {/* Login Form */}
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 28
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@medfellow.com"
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 14, outline: 'none',
                  fontFamily: "'DM Sans', sans-serif"
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 14, outline: 'none',
                  fontFamily: "'DM Sans', sans-serif"
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '10px 12px', marginBottom: 16, fontSize: 13, color: '#dc2626'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0', background: 'var(--teal)',
                color: 'white', border: 'none', borderRadius: 8, fontSize: 14,
                fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif"
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>First time?</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Setup button */}
          {!setupMode ? (
            <button
              onClick={() => setSetupMode(true)}
              style={{
                width: '100%', padding: '10px 0', background: 'transparent',
                color: 'var(--teal)', border: '1px solid var(--teal)', borderRadius: 8,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif"
              }}
            >
              Create Default Admin Account
            </button>
          ) : (
            <div style={{ background: 'var(--teal-light)', borderRadius: 8, padding: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 500, marginBottom: 6 }}>
                This will create an admin with:
              </p>
              <p style={{ fontSize: 12, color: 'var(--teal)', marginBottom: 4 }}>
                Email: <strong>admin@medfellow.com</strong>
              </p>
              <p style={{ fontSize: 12, color: 'var(--teal)', marginBottom: 14 }}>
                Password: <strong>MedAdmin@2025</strong>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSetup}
                  disabled={setupLoading}
                  style={{
                    flex: 1, padding: '9px 0', background: 'var(--teal)', color: 'white',
                    border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500,
                    cursor: setupLoading ? 'not-allowed' : 'pointer',
                    opacity: setupLoading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  {setupLoading ? 'Creating…' : 'Confirm Create'}
                </button>
                <button
                  onClick={() => setSetupMode(false)}
                  style={{
                    padding: '9px 16px', background: 'transparent', color: 'var(--teal)',
                    border: '1px solid var(--teal)', borderRadius: 7, fontSize: 13,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
