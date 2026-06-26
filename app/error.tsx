'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '32px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: '#fef2f2',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                  stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '24px',
          color: 'var(--text)',
          marginBottom: '8px',
        }}>
          Something went wrong
        </h1>
        
        <p style={{
          fontSize: '14px',
          color: 'var(--muted)',
          marginBottom: '24px',
          lineHeight: '1.5',
        }}>
          We encountered an unexpected error. Please try again or contact support if the problem persists.
        </p>

        {error.message && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#dc2626',
            textAlign: 'left',
            wordBreak: 'break-word',
          }}>
            <strong>Error:</strong> {error.message}
          </div>
        )}

        <button
          onClick={reset}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: 'var(--teal)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'opacity 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          Try Again
        </button>

        <a
          href="/login"
          style={{
            display: 'inline-block',
            marginTop: '16px',
            fontSize: '13px',
            color: 'var(--teal)',
            textDecoration: 'none',
          }}
        >
          Return to Login
        </a>
      </div>
    </div>
  )
}
