import Link from 'next/link'

export default function NotFound() {
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
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '120px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: '1',
          marginBottom: '20px',
        }}>
          404
        </div>
        
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '32px',
          color: 'var(--text)',
          marginBottom: '12px',
        }}>
          Page Not Found
        </h1>
        
        <p style={{
          fontSize: '16px',
          color: 'var(--muted)',
          marginBottom: '32px',
          lineHeight: '1.6',
        }}>
          The page you're looking for doesn't exist or has been moved.
        </p>

        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '12px 32px',
            background: 'var(--teal)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            textDecoration: 'none',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'opacity 0.2s',
          }}
        >
          Go to Login
        </Link>
      </div>
    </div>
  )
}
