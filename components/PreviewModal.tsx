'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import ReactPlayer to avoid SSR issues
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false }) as any

interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  type: 'video' | 'audio' | 'ppt' | 'pdf' | 'document'
  url: string
}

export default function PreviewModal({ isOpen, onClose, title, type, url }: PreviewModalProps) {
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          borderRadius: 12,
          maxWidth: type === 'video' ? 1200 : type === 'audio' ? 700 : 900,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{title}</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              {type === 'video' ? '🎬 Video Preview' : 
               type === 'audio' ? '🎵 Audio Preview' :
               type === 'ppt' ? '📊 Presentation Preview' : 
               type === 'document' ? '📝 Document Preview' :
               '📄 PDF Preview'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--muted)',
            }}
            title="Close (ESC)"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: type === 'video' ? '#000' : 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: type === 'video' ? 0 : 20,
          }}
        >
          {type === 'video' ? (
            <div style={{ width: '100%', aspectRatio: '16/9' }}>
              <ReactPlayer
                url={url}
                controls
                width="100%"
                height="100%"
                style={{ backgroundColor: '#000' }}
              />
            </div>
          ) : type === 'audio' ? (
            <div style={{ width: '100%', maxWidth: 600, padding: 40, textAlign: 'center' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  marginBottom: 24,
                }}
              >
                🎵
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 24 }}>Audio Player</h4>
              <audio
                controls
                src={url}
                style={{
                  width: '100%',
                  outline: 'none',
                  marginBottom: 20,
                }}
              />
              <a
                href={url}
                download={title}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  background: 'var(--teal)',
                  color: 'white',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Download Audio
              </a>
            </div>
          ) : type === 'pdf' ? (
            <iframe
              src={url}
              style={{
                width: '100%',
                height: '70vh',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
              title={title}
            />
          ) : type === 'document' ? (
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
              style={{
                width: '100%',
                height: '70vh',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
              title={title}
            />
          ) : (
            // PPT preview using Google Docs Viewer
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
              style={{
                width: '100%',
                height: '70vh',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
              title={title}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
