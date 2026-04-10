'use client'

import { useState } from 'react'
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
  type: 'video' | 'ppt' | 'pdf'
  title: string
  storage_path: string
  order_index: number
}

interface Props {
  course: { id: string; title: string; description: string }
  modules: Module[]
  subTopicsByModule: Record<string, SubTopic[]>
  contentByModule: Record<string, ContentItem[]>
  contentBySubTopic: Record<string, ContentItem[]>
  videoUrls: Record<string, string>
}

export default function StudentCourseClient({ 
  course, 
  modules, 
  subTopicsByModule,
  contentByModule, 
  contentBySubTopic,
  videoUrls 
}: Props) {
  const firstUnlocked = modules.find(m => !m.is_locked)
  const [activeModule, setActiveModule] = useState<Module | null>(firstUnlocked || null)
  const [activeSubTopic, setActiveSubTopic] = useState<SubTopic | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
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

  // Get current content based on active module/sub-topic
  let currentContent: ContentItem[] = []
  if (activeSubTopic) {
    currentContent = contentBySubTopic[activeSubTopic.id] || []
  } else if (activeModule) {
    currentContent = contentByModule[activeModule.id] || []
  }
  
  const videos = currentContent.filter(i => i.type === 'video')
  const resources = currentContent.filter(i => i.type === 'ppt' || i.type === 'pdf')

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

  async function handleDownload(storagePath: string, title: string) {
    const res = await fetch(`/api/download?path=${encodeURIComponent(storagePath)}`)
    if (!res.ok) { alert('Download failed. You may not have access to this file.'); return }
    const { url } = await res.json()
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = title
      a.click()
      
      // Log download activity
      const contentItem = resources.find(r => r.storage_path === storagePath)
      if (contentItem) {
        logActivity('downloaded_resource', contentItem.id, activeModule?.id, activeSubTopic?.id)
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Topbar */}
      <div style={{
        background: 'var(--white)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', height: 52, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/student/courses" style={{
            fontSize: 12, color: 'var(--muted)', textDecoration: 'none',
            padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6
          }}>
            ← Courses
          </Link>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17 }}>
            {course.title}
            {activeModule && ` — ${activeModule.title}`}
            {activeSubTopic && ` • ${activeSubTopic.title}`}
          </span>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'var(--teal-light)', color: 'var(--teal)',
          fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500
        }}>
          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {unlockedCount} of {modules.length} modules unlocked
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Module sidebar */}
        <div style={{
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
                      const docs = items.filter(i => i.type !== 'video').length
                      return (
                        <>
                          {vids > 0 && <span>{vids} video{vids !== 1 ? 's' : ''}</span>}
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
            <div style={{
              background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
              aspectRatio: '16/9', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              <div style={{
                width: 48, height: 48, background: '#f3f4f6', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#9ca3af">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--muted)' }}>Module Locked</p>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>Your admin will unlock this module</p>
            </div>
          ) : (
            <>
              {/* Video player */}
              {activeVideo && videoUrls[activeVideo.id] ? (
                <div style={{ background: '#0d1117', borderRadius: 10, overflow: 'hidden' }}>
                  <video
                    key={activeVideo.id}
                    src={videoUrls[activeVideo.id]}
                    controls
                    controlsList="nodownload nofullscreen"
                    onContextMenu={e => e.preventDefault()}
                    onTimeUpdate={(e) => {
                      const video = e.currentTarget
                      const currentTime = video.currentTime
                      const duration = video.duration
                      
                      // Track progress every 10 seconds
                      if (Math.floor(currentTime) % 10 === 0) {
                        trackVideoProgress(activeVideo.id, currentTime, duration, false)
                      }
                      
                      // Auto-mark as complete if watched 90%+
                      if (currentTime / duration > 0.9) {
                        trackVideoProgress(activeVideo.id, currentTime, duration, true)
                      }
                    }}
                    onEnded={() => {
                      if (activeVideo) {
                        trackVideoProgress(activeVideo.id, activeVideo.id.length, activeVideo.id.length, true)
                      }
                    }}
                    onPlay={() => {
                      logActivity('viewed_video', activeVideo.id, activeModule?.id, activeSubTopic?.id)
                    }}
                    style={{ width: '100%', display: 'block', maxHeight: '60vh' }}
                  />
                </div>
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
                    const isPpt = item.type === 'ppt'
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 0', borderBottom: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 4,
                            background: isPpt ? '#fff3e0' : '#fce4ec',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 600,
                            color: isPpt ? '#e65100' : '#c62828'
                          }}>
                            {item.type.toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 500 }}>{item.title}</p>
                            <p style={{ fontSize: 11, color: 'var(--muted)' }}>{item.type.toUpperCase()} file</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(item.storage_path, item.title)}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
