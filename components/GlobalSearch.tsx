'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface SearchResult {
  id: string
  title: string
  description: string | null
  course_id: string
  module_id: string | null
  rank: number
}

interface GroupedResults {
  courses: SearchResult[]
  modules: SearchResult[]
  subtopics: SearchResult[]
  content: SearchResult[]
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GroupedResults>({ courses: [], modules: [], subtopics: [], content: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Flatten results for keyboard navigation
  const flatResults = [
    ...results.courses.map(r => ({ ...r, type: 'course' })),
    ...results.modules.map(r => ({ ...r, type: 'module' })),
    ...results.subtopics.map(r => ({ ...r, type: 'subtopic' })),
    ...results.content.map(r => ({ ...r, type: 'content' }))
  ]

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ courses: [], modules: [], subtopics: [], content: [] })
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results || { courses: [], modules: [], subtopics: [], content: [] })
        setSelectedIndex(0)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Keyboard shortcut to open/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Keyboard navigation in results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % flatResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + flatResults.length) % flatResults.length)
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault()
      handleSelect(flatResults[selectedIndex])
    }
  }

  const handleSelect = (result: SearchResult & { type: string }) => {
    setIsOpen(false)
    setQuery('')
    
    // Navigate based on result type
    switch (result.type) {
      case 'course':
        router.push(`/student/courses/${result.id}`)
        break
      case 'module':
        router.push(`/student/courses/${result.course_id}`)
        break
      case 'subtopic':
        router.push(`/student/courses/${result.course_id}`)
        break
      case 'content':
        router.push(`/student/courses/${result.course_id}`)
        break
    }
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'course':
        return (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
          </svg>
        )
      case 'module':
        return (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
        )
      case 'subtopic':
        return (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        )
      case 'content':
        return (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  const renderResults = () => {
    if (loading) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Searching...
        </div>
      )
    }

    if (!query.trim()) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Type to search courses, modules, and content
        </div>
      )
    }

    if (flatResults.length === 0) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No results found for "{query}"</p>
        </div>
      )
    }

    let currentIndex = 0

    return (
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {results.courses.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Courses
            </div>
            {results.courses.map(result => {
              const idx = currentIndex++
              return (
                <button
                  key={result.id}
                  onClick={() => handleSelect({ ...result, type: 'course' })}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: idx === selectedIndex ? 'var(--teal-soft)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ color: 'var(--teal)', flexShrink: 0 }}>
                    {getResultIcon('course')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.title}
                    </div>
                    {result.description && (
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {result.description}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {results.modules.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 }}>
              Modules
            </div>
            {results.modules.map(result => {
              const idx = currentIndex++
              return (
                <button
                  key={result.id}
                  onClick={() => handleSelect({ ...result, type: 'module' })}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: idx === selectedIndex ? 'var(--teal-soft)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ color: 'var(--teal)', flexShrink: 0 }}>
                    {getResultIcon('module')}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {result.title}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {results.subtopics.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 }}>
              Sub-topics
            </div>
            {results.subtopics.map(result => {
              const idx = currentIndex++
              return (
                <button
                  key={result.id}
                  onClick={() => handleSelect({ ...result, type: 'subtopic' })}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: idx === selectedIndex ? 'var(--teal-soft)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ color: 'var(--teal)', flexShrink: 0 }}>
                    {getResultIcon('subtopic')}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {result.title}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {results.content.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 }}>
              Content
            </div>
            {results.content.map(result => {
              const idx = currentIndex++
              return (
                <button
                  key={result.id}
                  onClick={() => handleSelect({ ...result, type: 'content' })}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: idx === selectedIndex ? 'var(--teal-soft)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ color: 'var(--teal)', flexShrink: 0 }}>
                    {getResultIcon('content')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.title}
                    </div>
                    {result.description && (
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, textTransform: 'uppercase' }}>
                        {result.description}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Trigger button - can be placed anywhere */}
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-ghost btn-sm"
        style={{ gap: 8 }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        Search
        <kbd style={{ 
          fontSize: 10, 
          padding: '2px 6px', 
          background: 'var(--bg-elev)', 
          borderRadius: 4, 
          border: '1px solid var(--border)',
          fontFamily: 'monospace'
        }}>
          ⌘K
        </kbd>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 9998,
                backdropFilter: 'blur(4px)'
              }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="search-modal"
              style={{
                position: 'fixed',
                top: '15%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                maxWidth: 600,
                background: 'var(--white)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-lg)',
                zIndex: 9999,
                overflow: 'hidden'
              }}
            >
              {/* Search Input */}
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="var(--muted)">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search courses, modules, content..."
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: 15,
                    background: 'transparent',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                />
                <kbd style={{ 
                  fontSize: 10, 
                  padding: '2px 6px', 
                  background: 'var(--bg)', 
                  borderRadius: 4, 
                  border: '1px solid var(--border)',
                  fontFamily: 'monospace',
                  color: 'var(--muted)'
                }}>
                  ESC
                </kbd>
              </div>

              {/* Results */}
              {renderResults()}

              {/* Footer */}
              {flatResults.length > 0 && (
                <div style={{ 
                  padding: '10px 16px', 
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 11,
                  color: 'var(--muted)',
                  background: 'var(--bg)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <kbd style={{ padding: '2px 5px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 3, fontFamily: 'monospace' }}>↑↓</kbd>
                    Navigate
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <kbd style={{ padding: '2px 5px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 3, fontFamily: 'monospace' }}>↵</kbd>
                    Select
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
