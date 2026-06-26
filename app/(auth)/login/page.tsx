'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase'
import { loginSchema, type LoginInput } from '@/lib/schemas'

export default function LoginPage() {
  const router = useRouter()
  const [authError, setAuthError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setAuthError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword(values)

    if (error) {
      setAuthError(error.message)
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
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #d4f0e3 0%, var(--bg) 45%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: 'center', marginBottom: 28 }}
        >
          <div style={{
            width: 56, height: 56, background: 'var(--grad-teal)', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 10px 24px rgba(15, 110, 86, 0.28)'
          }}>
            <svg width="26" height="26" viewBox="0 0 16 16" fill="white">
              <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11L3.5 14.5L5 9.5L1 6H6Z" />
            </svg>
          </div>
          <h1 className="page-title" style={{ color: 'var(--teal)', marginBottom: 4 }}>
            MedFellow Academy
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Sign in to continue learning</p>
        </motion.div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="card"
          style={{ padding: 28, boxShadow: 'var(--shadow-md)' }}
        >
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Email</label>
              <input
                type="email"
                placeholder="you@medfellow.com"
                autoComplete="email"
                {...register('email')}
                className="input"
                style={errors.email ? { borderColor: 'var(--danger)' } : undefined}
              />
              {errors.email && (
                <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 5 }}>{errors.email.message}</p>
              )}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="field-label">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                className="input"
                style={errors.password ? { borderColor: 'var(--danger)' } : undefined}
              />
              {errors.password && (
                <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 5 }}>{errors.password.message}</p>
              )}
            </div>

            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8,
                  padding: '10px 12px', marginBottom: 14, fontSize: 13, color: 'var(--danger)'
                }}
              >
                {authError}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </div>
  )
}
