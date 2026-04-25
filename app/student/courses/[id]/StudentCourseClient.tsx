'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface Module {
  id: string
  title: string
  order_index: number
  is_locked: boolean
}

interface SubTopic {
  id: string
  module_id: string
  title: string
  order_index: number
  is_locked: boolean
}

interface ContentItem {
  id: string
  module_id: string
  sub_topic_id?: string
  type: 'video' | 'audio' | 'ppt' | 'pdf' | 'document'
  title: string
  storage_path: string
  order_index: number
}

interface CourseEbook {
  id: string
  course_id: string
  title: string
  storage_path: string
  created_at: string
}

interface Assessment {
  id: string
  module_id: string
  title: string
  type: 'quiz' | 'assignment' | 'exam'
  time_limit_minutes: number | null
  max_attempts: number
  due_date: string | null
  published: boolean
}

interface Props {
  course: { id: string; title: string; description: string }
  courseEbooks: CourseEbook[]
  modules: Module[]
  subTopicsByModule: Record<string, SubTopic[]>
  contentByModule: Record<string, ContentItem[]>
  contentBySubTopic: Record<string, ContentItem[]>
  videoUrls: Record<string, string>
  assessmentsByModule: Record<string, Assessment[]>
}

export default function StudentCourseClient({ 
  course, 
  courseEbooks,
  modules, 
  subTopicsByModule,
  contentByModule, 
  contentBySubTopic,
  videoUrls,
  assessmentsByModule
}: Props) {
  const firstUnlocked = modules.find(m => !m.is_locked)
  const [activeModule, setActiveModule] = useState<Module | null>(firstUnlocked || null)
  const [activeSubTopic, setActiveSubTopic] = useState<SubTopic | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showNotes, setShowNotes] = useState(false)
  const [currentNote, setCurrentNote] = useState('')
  const [videoNotes, setVideoNotes] = useState<any[]>([])
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [activeVideo, setActiveVideo] = useState<ContentItem | null>(() => {
    if (!firstUnlocked) return null
    
    // Try to find video in sub-topics first
    const subTopics = subTopicsByModule[firstUnlocked.id] || []
    const unlockedSubTopic = subTopics.find(st => !st.is_locked)
    if (unlockedSubTopic) {
      const items = contentBySubTopic[unlockedSubTopic.id] || []
      const video = items.find(i => i.type === 'video')
      if (video) return video
    }
    
    // Fall back to module-level content
    const items = contentByModule[firstUnlocked.id] || []
    return items.find(i => i.type === 'video') || null
  })

  const unlockedCount = modules.filter(m => !m.is_locked).length
  const playerRef = useRef<any>(null)

  // Debug: Log video URLs
  useEffect(() => {
    console.log('Video URLs:', videoUrls)
    console.log('Active Video:', activeVideo)
    if (activeVideo) {
      console.log('Active Video URL:', videoUrls[activeVideo.id])
    }
  }, [activeVideo, videoUrls])

  // Load notes and bookmarks when active video changes
  useEffect(() => {
    if (activeVideo) {
      loadNotesAndBookmarks()
    }
  }, [activeVideo?.id])

  async function loadNotesAndBookmarks() {
    if (!activeVideo) return
    try {
      const [notesRes, bookmarksRes] = await Promise.all([
        fetch(`/api/notes?content_id=${activeVideo.id}`),
        fetch(`/api/bookmarks?content_id=${activeVideo.id}`)
      ])
      if (notesRes.ok) setVideoNotes(await notesRes.json())
      if (bookmarksRes.ok) setBookmarks(await bookmarksRes.json())
    } catch (error) {
      console.error('Failed to load notes/bookmarks:', error)
    }
  }

  async function saveNote() {
    if (!activeVideo || !currentNote.trim()) return
    const currentTime = playerRef.current?.getCurrentTime() || 0
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: activeVideo.id,
          module_id: activeModule?.id,
          course_id: course.id,
          note_text: currentNote.trim(),
          timestamp_seconds: Math.floor(currentTime)
        })
      })
      if (res.ok) {
        setCurrentNote('')
        loadNotesAndBookmarks()
      }
    } catch (error) {
      console.error('Failed to save note:', error)
    }
  }

  async function addBookmark(title: string) {
    if (!activeVideo) return
    const currentTime = playerRef.current?.getCurrentTime() || 0
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: activeVideo.id,
          module_id: activeModule?.id,
          title: title || `Bookmark at ${formatTime(currentTime)}`,
          timestamp_seconds: Math.floor(currentTime)
        })
      })
      if (res.ok) loadNotesAndBookmarks()
    } catch (error) {
      console.error('Failed to add bookmark:', error)
    }
  }

  async function deleteNote(noteId: string) {
    try {
      await fetch(`/api/notes?id=${noteId}`, { method: 'DELETE' })
      loadNotesAndBookmarks()
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  async function deleteBookmark(bookmarkId: string) {
    try {
      await fetch(`/api/bookmarks?id=${bookmarkId}`, { method: 'DELETE' })
      loadNotesAndBookmarks()
    } catch (error) {
      console.error('Failed to delete bookmark:', error)
    }
  }

  function seekTo(seconds: number) {
    if (playerRef.current) {
      playerRef.current.currentTime = seconds
      playerRef.current.play()
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get current content based on active module/sub-topic
  let currentContent: ContentItem[] = []
  if (activeSubTopic) {
    currentContent = contentBySubTopic[activeSubTopic.id] || []
  } else if (activeModule) {
    currentContent = contentByModule[activeModule.id] || []
  }
  
  const videos = currentContent.filter(i => i.type === 'video')
  const resources = currentContent.filter(i => i.type === 'audio' || i.type === 'ppt' || i.type === 'pdf' || i.type === 'document')
  
  // Get assessments for active module
  const assessments = activeModule ? (assessmentsByModule[activeModule.id] || []) : []

  // Track video progress
  async function trackVideoProgress(contentId: string, currentTime: number, duration: number, completed: boolean) {
    try {
      await fetch('/api/video-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: contentId,
          watch_time_seconds: Math.floor(currentTime),
          total_duration_seconds: Math.floor(duration),
          completed
        })
      })
    } catch (error) {
      console.error('Failed to track progress:', error)
    }
  }

  // Log activity
  async function logActivity(type: string, contentId?: string, moduleId?: string, subTopicId?: string) {
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: type,
          content_id: contentId,
          module_id: moduleId,
          sub_topic_id: subTopicId
        })
      })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }
  }

  async function handleDownload(storagePath: string, title: string, contentId?: string) {
    const res = await fetch(`/api/download?path=${encodeURIComponent(storagePath)}`)
    if (!res.ok) { alert('Download failed. You may not have access to this file.'); return }
    const { url } = await res.json()
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = title
      a.click()
      
      // Log download activity
      if (contentId) {
        logActivity('downloaded_resource', contentId, activeModule?.id, activeSubTopic?.id)
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Topbar */}
      <div className="course-topbar" style={{
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 56, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0, gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
          <Link href="/student/courses" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
            </svg>
            Courses
          </Link>
          <Link href={`/student/courses/${course.id}/discussions`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/><path d="M15 7v2a4 4 0 01-4 4v2a6 6 0 006-6V7h-2z"/>
            </svg>
            Discussions
          </Link>
          <Link href={`/student/courses/${course.id}/qa`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
            Q&A
          </Link>
          <div style={{ minWidth: 0 }}>
            <div className="course-title" style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {course.title}
            </div>
            {(activeModule || activeSubTopic) && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeModule?.title}{activeSubTopic ? ` • ${activeSubTopic.title}` : ''}
              </div>
            )}
          </div>
        </div>
        <div className="chip" style={{ flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {unlockedCount} / {modules.length} unlocked
        </div>
      </div>

      {/* Main content */}
      <div className="course-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Module sidebar */}
        <div className="course-modules" style={{
          width: 240, background: 'var(--white)', borderRight: '1px solid var(--border)',
          overflowY: 'auto', padding: 16, flexShrink: 0
        }}>
          <p style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
            Modules
          </p>
          {modules.map(mod => {
            const isActive = activeModule?.id === mod.id && !activeSubTopic
            const subTopics = subTopicsByModule[mod.id] || []
            const hasSubTopics = subTopics.length > 0
            const isExpanded = expandedModules.has(mod.id)
            
            return (
              <div key={mod.id} style={{ marginBottom: 8 }}>
                <div
                  onClick={() => {
                    if (!mod.is_locked) {
                      // Toggle expansion if has sub-topics
                      if (hasSubTopics) {
                        setExpandedModules(prev => {
                          const next = new Set(prev)
                          if (next.has(mod.id)) {
                            next.delete(mod.id)
                          } else {
                            next.add(mod.id)
                          }
                          return next
                        })
                      } else {
                        // If no sub-topics, set as active and show content
                        setActiveModule(mod)
                        setActiveSubTopic(null)
                        const items = contentByModule[mod.id] || []
                        setActiveVideo(items.find(i => i.type === 'video') || null)
                      }
                    }
                  }}
                  style={{
                    background: 'var(--white)',
                    border: `1px solid ${isActive ? 'var(--teal)' : 'var(--border)'}`,
                    borderRadius: 8, overflow: 'hidden',
                    cursor: mod.is_locked ? 'default' : 'pointer',
                    opacity: mod.is_locked ? 0.6 : 1
                  }}
                >
                  <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: isActive ? 'var(--teal)' : mod.is_locked ? '#f3f4f6' : 'var(--teal-light)',
                      color: isActive ? 'white' : mod.is_locked ? '#9ca3af' : 'var(--teal)',
                      fontSize: 10, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                    {mod.order_index + 1}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, color: mod.is_locked ? '#9ca3af' : 'var(--text)' }}>
                      {mod.title}
                    </p>
                  </div>
                  {mod.is_locked ? (
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="#d1d5db">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  ) : hasSubTopics ? (
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 20 20" 
                      fill="var(--teal)"
                      style={{ 
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="var(--teal)">
                      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0v1h2V7a5 5 0 00-5-5z" />
                    </svg>
                  )}
                </div>
                </div>
                
                {/* Sub-topics list - show only when expanded */}
                {!mod.is_locked && hasSubTopics && isExpanded && (
                  <div style={{ marginLeft: 12, marginTop: 4 }}>
                    {subTopics.map(st => {
                      const isSubActive = activeSubTopic?.id === st.id
                      return (
                        <div
                          key={st.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!st.is_locked) {
                              setActiveModule(mod)
                              setActiveSubTopic(st)
                              const items = contentBySubTopic[st.id] || []
                              setActiveVideo(items.find(i => i.type === 'video') || null)
                            }
                          }}
                          style={{
                            padding: '6px 10px',
                            marginBottom: 3,
                            borderLeft: `2px solid ${isSubActive ? 'var(--teal)' : st.is_locked ? '#e5e7eb' : '#bae6fd'}`,
                            marginLeft: 8,
                            cursor: st.is_locked ? 'default' : 'pointer',
                            opacity: st.is_locked ? 0.5 : 1,
                            background: isSubActive ? 'var(--teal-light)' : 'transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: 10, color: st.is_locked ? '#9ca3af' : 'var(--teal)' }}>
                              {st.is_locked ? '🔒' : '•'}
                            </div>
                            <p style={{ fontSize: 11, color: st.is_locked ? '#9ca3af' : 'var(--text)', lineHeight: 1.3 }}>
                              {st.title}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                
                {/* Module-level content count (if no sub-topics) */}
                {!mod.is_locked && !hasSubTopics && (
                  <div style={{ padding: '0 12px 8px', fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 10 }}>
                    {(() => {
                      const items = contentByModule[mod.id] || []
                      const vids = items.filter(i => i.type === 'video').length
                      const audios = items.filter(i => i.type === 'audio').length
                      const docs = items.filter(i => i.type === 'ppt' || i.type === 'pdf' || i.type === 'document').length
                      return (
                        <>
                          {vids > 0 && <span>{vids} video{vids !== 1 ? 's' : ''}</span>}
                          {audios > 0 && <span>{audios} audio{audios !== 1 ? 's' : ''}</span>}
                          {docs > 0 && <span>{docs} doc{docs !== 1 ? 's' : ''}</span>}
                          {items.length === 0 && <span>No content yet</span>}
                        </>
                      )
                    })()}
                  </div>
                )}
                
                {mod.is_locked && (
                  <div style={{ padding: '0 12px 8px', fontSize: 11, color: '#d1d5db' }}>
                    Locked by admin
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Video + content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!activeModule || activeModule.is_locked ? (
            <div className="card" style={{
              aspectRatio: '16/9', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'linear-gradient(180deg, var(--teal-soft) 0%, var(--white) 100%)'
            }}>
              <div style={{
                width: 56, height: 56, background: 'var(--white)', borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)', color: 'var(--teal)'
              }}>
                <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Module Locked</p>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Your admin will unlock this module for you</p>
            </div>
          ) : (
            <>
              {courseEbooks.length > 0 && (
                <div className="card card-pad" style={{ padding: '14px 18px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                    Course E-Books
                  </p>
                  {courseEbooks.map((ebook, idx) => (
                    <div key={ebook.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', borderBottom: idx === courseEbooks.length - 1 ? 'none' : '1px solid var(--border)',
                      gap: 10, flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8,
                          background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10.5, fontWeight: 700, color: '#be185d', flexShrink: 0
                        }}>
                          PDF
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ebook.title}</p>
                          <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>Available for the full course</p>
                        </div>
                      </div>
                      <button onClick={() => handleDownload(ebook.storage_path, ebook.title)} className="btn btn-secondary btn-sm">
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Video player */}
              {activeVideo ? (
                videoUrls[activeVideo.id] ? (
                <>
                  <div style={{ 
                    background: '#0d1117', 
                    borderRadius: 10, 
                    overflow: 'hidden',
                    position: 'relative',
                    width: '100%',
                    paddingTop: '56.25%' /* 16:9 ratio fallback for Safari/iPad */
                  }}>
                    <video
                      ref={playerRef}
                      key={activeVideo.id}
                      controls
                      playsInline
                      webkit-playsinline="true"
                      x-webkit-airplay="allow"
                      preload="metadata"
                      className="video-player"
                      onLoadedMetadata={(e: any) => {
                        const video = e.target as HTMLVideoElement
                        video.playbackRate = playbackRate
                        const savedTime = localStorage.getItem(`video_${activeVideo.id}`)
                        if (savedTime && parseFloat(savedTime) > 5) {
                          video.currentTime = parseFloat(savedTime)
                        }
                      }}
                      onTimeUpdate={(e: any) => {
                        const video = e.target as HTMLVideoElement
                        const currentTime = video.currentTime
                        const duration = video.duration
                        if (Math.floor(currentTime) % 5 === 0) {
                          localStorage.setItem(`video_${activeVideo.id}`, currentTime.toString())
                        }
                        if (Math.floor(currentTime) % 10 === 0 && currentTime > 0) {
                          trackVideoProgress(activeVideo.id, currentTime, duration, false)
                        }
                        if (currentTime / duration > 0.9) {
                          trackVideoProgress(activeVideo.id, currentTime, duration, true)
                        }
                      }}
                      onEnded={() => {
                        if (activeVideo) {
                          trackVideoProgress(activeVideo.id, 0, 0, true)
                          localStorage.removeItem(`video_${activeVideo.id}`)
                        }
                      }}
                      onPlay={() => {
                        logActivity('viewed_video', activeVideo.id, activeModule?.id, activeSubTopic?.id)
                      }}
                      onError={(e: any) => {
                        console.error('Video Error:', e)
                      }}
                    >
                      <source src={videoUrls[activeVideo.id]} type="video/mp4" />
                      <source src={videoUrls[activeVideo.id]} />
                    </video>
                      onLoadedMetadata={(e: any) => {
                        const video = e.target as HTMLVideoElement
                        video.playbackRate = playbackRate
                        
                        // Resume from last position
                        const savedTime = localStorage.getItem(`video_${activeVideo.id}`)
                        if (savedTime && parseFloat(savedTime) > 5) {
                          video.currentTime = parseFloat(savedTime)
                        }
                      }}
                      onTimeUpdate={(e: any) => {
                        const video = e.target as HTMLVideoElement
                        const currentTime = video.currentTime
                        const duration = video.duration
                        
                        // Save position for resume
                        if (Math.floor(currentTime) % 5 === 0) {
                          localStorage.setItem(`video_${activeVideo.id}`, currentTime.toString())
                        }
                        
                        // Track progress every 10 seconds
                        if (Math.floor(currentTime) % 10 === 0 && currentTime > 0) {
                          trackVideoProgress(activeVideo.id, currentTime, duration, false)
                        }
                        
                        // Auto-mark as complete if watched 90%+
                        if (currentTime / duration > 0.9) {
                          trackVideoProgress(activeVideo.id, currentTime, duration, true)
                        }
                      }}
                      onEnded={() => {
                        if (activeVideo) {
                          trackVideoProgress(activeVideo.id, 0, 0, true)
                          localStorage.removeItem(`video_${activeVideo.id}`)
                        }
                      }}
                      onPlay={() => {
                        logActivity('viewed_video', activeVideo.id, activeModule?.id, activeSubTopic?.id)
                      }}
                      onError={(e: any) => {
                        console.error('Video Error:', e)
                      }}
                    />
                  </div>

                  {/* Video Controls */}
                  <div style={{
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Speed:</span>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                        <button
                          key={rate}
                          onClick={() => {
                            setPlaybackRate(rate)
                            if (playerRef.current) {
                              playerRef.current.playbackRate = rate
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            background: playbackRate === rate ? 'var(--teal)' : 'var(--bg)',
                            color: playbackRate === rate ? 'white' : 'var(--text)',
                            border: `1px solid ${playbackRate === rate ? 'var(--teal)' : 'var(--border)'}`,
                            borderRadius: 5,
                            cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                    <div style={{ height: 20, width: 1, background: 'var(--border)' }} />
                    <button
                      onClick={() => setShowNotes(!showNotes)}
                      style={{
                        padding: '5px 12px',
                        fontSize: 12,
                        background: showNotes ? 'var(--teal-light)' : 'var(--bg)',
                        color: showNotes ? 'var(--teal)' : 'var(--text)',
                        border: `1px solid ${showNotes ? 'var(--teal)' : 'var(--border)'}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      📝 Notes ({videoNotes.length})
                    </button>
                    <button
                      onClick={() => {
                        const title = prompt('Bookmark name:')
                        if (title) addBookmark(title)
                      }}
                      style={{
                        padding: '5px 12px',
                        fontSize: 12,
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      🔖 Add Bookmark
                    </button>
                  </div>

                  {/* Notes Section */}
                  {showNotes && (
                    <div style={{
                      background: 'var(--white)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 16
                    }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Video Notes</h4>
                      
                      {/* Add Note */}
                      <div style={{ marginBottom: 16 }}>
                        <textarea
                          value={currentNote}
                          onChange={(e) => setCurrentNote(e.target.value)}
                          placeholder="Take a note at current timestamp..."
                          style={{
                            width: '100%',
                            minHeight: 60,
                            padding: 10,
                            fontSize: 12,
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            fontFamily: "'DM Sans', sans-serif",
                            resize: 'vertical'
                          }}
                        />
                        <button
                          onClick={saveNote}
                          disabled={!currentNote.trim()}
                          style={{
                            marginTop: 8,
                            padding: '6px 16px',
                            fontSize: 12,
                            background: 'var(--teal)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: currentNote.trim() ? 'pointer' : 'not-allowed',
                            opacity: currentNote.trim() ? 1 : 0.5,
                            fontFamily: "'DM Sans', sans-serif"
                          }}
                        >
                          Save Note
                        </button>
                      </div>

                      {/* Notes List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {videoNotes.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
                            No notes yet. Take your first note!
                          </p>
                        ) : (
                          videoNotes.map((note: any) => (
                            <div
                              key={note.id}
                              style={{
                                padding: 10,
                                background: 'var(--bg)',
                                border: '1px solid var(--border)',
                                borderRadius: 6
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <button
                                  onClick={() => seekTo(note.timestamp_seconds)}
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--teal)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontWeight: 500
                                  }}
                                >
                                  ⏱ {formatTime(note.timestamp_seconds)}
                                </button>
                                <button
                                  onClick={() => deleteNote(note.id)}
                                  style={{
                                    fontSize: 11,
                                    color: '#ef4444',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                              <p style={{ fontSize: 12, lineHeight: 1.5 }}>{note.note_text}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Bookmarks */}
                      {bookmarks.length > 0 && (
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                          <h5 style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>🔖 Bookmarks</h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {bookmarks.map((bookmark: any) => (
                              <div
                                key={bookmark.id}
                                style={{
                                  padding: '6px 10px',
                                  background: 'var(--bg)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 5,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                              >
                                <button
                                  onClick={() => seekTo(bookmark.timestamp_seconds)}
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--teal)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    textAlign: 'left',
                                    flex: 1
                                  }}
                                >
                                  {bookmark.title} - {formatTime(bookmark.timestamp_seconds)}
                                </button>
                                <button
                                  onClick={() => deleteBookmark(bookmark.id)}
                                  style={{
                                    fontSize: 11,
                                    color: '#ef4444',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  background: '#0d1117', borderRadius: 10, aspectRatio: '16/9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', padding: 40, textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🎥</div>
                    <div style={{ fontSize: 16, marginBottom: 8 }}>Video not available</div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      This video is being processed or the URL could not be generated.
                      <br />Please refresh the page or contact support.
                    </div>
                  </div>
                </div>
              )
              ) : videos.length === 0 ? (
                <div style={{
                  background: '#0d1117', borderRadius: 10, aspectRatio: '16/9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No videos in this module</p>
                </div>
              ) : null}

              {/* Video list (if multiple) */}
              {videos.length > 1 && (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Videos
                  </p>
                  {videos.map((video, idx) => (
                    <div
                      key={video.id}
                      onClick={() => setActiveVideo(video)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                        borderRadius: 7, cursor: 'pointer', marginBottom: 4,
                        background: activeVideo?.id === video.id ? 'var(--teal-light)' : 'transparent'
                      }}
                    >
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: activeVideo?.id === video.id ? 'var(--teal)' : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <svg width="8" height="8" viewBox="0 0 20 20" fill={activeVideo?.id === video.id ? 'white' : '#9ca3af'}>
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                      <span style={{ fontSize: 13, color: activeVideo?.id === video.id ? 'var(--teal)' : 'var(--text)', fontWeight: activeVideo?.id === video.id ? 500 : 400 }}>
                        {idx + 1}. {video.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Video info */}
              {activeVideo && (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
                  <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 6 }}>
                    {activeVideo.title}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>{activeModule.title}</p>
                </div>
              )}

              {/* Resources */}
              {resources.length > 0 && (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Module Resources
                  </p>
                  {resources.map(item => {
                    const getResourceStyle = (type: string) => {
                      switch(type) {
                        case 'audio':
                          return { bg: '#f3e8ff', color: '#7c3aed', label: 'AUDIO' }
                        case 'ppt':
                          return { bg: '#fff3e0', color: '#e65100', label: 'PPT' }
                        case 'pdf':
                          return { bg: '#fce4ec', color: '#c62828', label: 'PDF' }
                        case 'document':
                          return { bg: '#e0f2fe', color: '#0369a1', label: 'DOC' }
                        default:
                          return { bg: '#f3f4f6', color: '#6b7280', label: 'FILE' }
                      }
                    }
                    
                    const style = getResourceStyle(item.type)
                    
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 0', borderBottom: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 4,
                            background: style.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 600,
                            color: style.color
                          }}>
                            {style.label}
                          </div>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 500 }}>{item.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {item.type === 'audio' ? 'Audio file' : 
                               item.type === 'document' ? 'Document file' :
                               `${item.type.toUpperCase()} file`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(item.storage_path, item.title, item.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 12, color: 'var(--teal)', cursor: 'pointer',
                            padding: '5px 10px', borderRadius: 6, border: '1px solid #9FE1CB',
                            background: 'transparent', fontFamily: "'DM Sans', sans-serif"
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Download
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Assessments */}
              {assessments.length > 0 && (
                <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Assessments
                  </p>
                  {assessments.map(assessment => {
                    const isDueSoon = assessment.due_date && new Date(assessment.due_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    const isOverdue = assessment.due_date && new Date(assessment.due_date) < new Date()
                    
                    return (
                      <Link 
                        key={assessment.id} 
                        href={`/student/assessments/${assessment.id}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', marginBottom: 8, borderRadius: 7,
                          border: '1px solid var(--border)',
                          background: 'var(--white)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        className="card-hover"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 6,
                              background: assessment.type === 'quiz' ? '#faf5ff' : assessment.type === 'exam' ? '#fef3c7' : '#e0f2fe',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700, flexShrink: 0,
                              color: assessment.type === 'quiz' ? '#7c3aed' : assessment.type === 'exam' ? '#b45309' : '#0369a1'
                            }}>
                              {assessment.type === 'quiz' ? 'QZ' : assessment.type === 'exam' ? 'EX' : 'AS'}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {assessment.title}
                              </p>
                              <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                                {assessment.time_limit_minutes && (
                                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                    ⏱ {assessment.time_limit_minutes}min
                                  </span>
                                )}
                                {assessment.max_attempts > 1 && (
                                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                    • {assessment.max_attempts} attempts
                                  </span>
                                )}
                                {assessment.due_date && (
                                  <span style={{ 
                                    fontSize: 11, 
                                    color: isOverdue ? '#dc2626' : isDueSoon ? '#d97706' : 'var(--muted)',
                                    fontWeight: (isOverdue || isDueSoon) ? 500 : 400
                                  }}>
                                    • Due {new Date(assessment.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--teal)">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
