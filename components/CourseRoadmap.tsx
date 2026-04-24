'use client'

import { motion } from 'framer-motion'

interface SubTopic {
  id: string
  title: string
  is_locked: boolean
  completed?: boolean
}

interface Module {
  id: string
  title: string
  order_index: number
  is_locked: boolean
  completed?: boolean
  sub_topics?: SubTopic[]
}

interface CourseRoadmapProps {
  modules: Module[]
  currentModuleId?: string
}

export default function CourseRoadmap({ modules, currentModuleId }: CourseRoadmapProps) {
  const getModuleStatus = (module: Module) => {
    if (module.completed) return 'completed'
    if (module.is_locked) return 'locked'
    if (module.id === currentModuleId) return 'current'
    return 'available'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.25)'
          }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="white">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'locked':
        return (
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#f3f4f6',
            border: '2px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="#9ca3af">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'current':
        return (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--grad-teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(15, 110, 86, 0.35)',
              border: '3px solid white',
              position: 'relative'
            }}
          >
            <div style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: '2px solid var(--teal)',
              opacity: 0.3
            }} />
            <svg width="14" height="14" viewBox="0 0 20 20" fill="white">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </motion.div>
        )
      case 'available':
        return (
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'white',
            border: '2px solid var(--teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--teal)'
            }} />
          </div>
        )
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'var(--success)'
      case 'locked': return '#d1d5db'
      case 'current': return 'var(--teal)'
      case 'available': return 'var(--teal)'
      default: return '#d1d5db'
    }
  }

  const sortedModules = [...modules].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="card card-pad" style={{ padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--teal)">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        <h3 style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>Course Roadmap</h3>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {modules.filter(m => m.completed).length} / {modules.length} completed
        </div>
      </div>

      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {sortedModules.map((module, index) => {
          const status = getModuleStatus(module)
          const isLast = index === sortedModules.length - 1
          const hasSubTopics = module.sub_topics && module.sub_topics.length > 0

          return (
            <div key={module.id} style={{ position: 'relative', paddingBottom: isLast ? 0 : 32 }}>
              {/* Connecting line */}
              {!isLast && (
                <div style={{
                  position: 'absolute',
                  left: 15,
                  top: 32,
                  bottom: -8,
                  width: 2,
                  background: getStatusColor(status),
                  opacity: status === 'completed' ? 1 : 0.2
                }} />
              )}

              {/* Module node */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  {getStatusIcon(status)}
                </div>

                <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                  {/* Module title */}
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: status === 'locked' ? 'var(--muted)' : 'var(--text)',
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--muted-2)', fontWeight: 500 }}>
                      #{module.order_index + 1}
                    </span>
                    {module.title}
                    {status === 'current' && (
                      <span className="chip chip-success" style={{ padding: '2px 8px', fontSize: 10 }}>
                        In Progress
                      </span>
                    )}
                  </div>

                  {/* Status text */}
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>
                    {status === 'completed' && '✓ Module completed'}
                    {status === 'locked' && '🔒 Locked - complete previous modules first'}
                    {status === 'current' && 'Continue learning this module'}
                    {status === 'available' && 'Ready to start'}
                  </div>

                  {/* Sub-topics */}
                  {hasSubTopics && status !== 'locked' && (
                    <div style={{ marginTop: 10, marginLeft: 12, paddingLeft: 12, borderLeft: '1px dashed var(--border)' }}>
                      {module.sub_topics!.map((subTopic, idx) => (
                        <div key={subTopic.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 0',
                          fontSize: 12.5
                        }}>
                          {subTopic.completed ? (
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="var(--success)">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : subTopic.is_locked ? (
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="#9ca3af">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              border: '2px solid var(--border)',
                              background: 'white'
                            }} />
                          )}
                          <span style={{
                            color: subTopic.is_locked ? 'var(--muted)' : 'var(--text-soft)',
                            textDecoration: subTopic.completed ? 'line-through' : 'none',
                            flex: 1
                          }}>
                            {subTopic.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        fontSize: 11.5
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--success)' }} />
          <span style={{ color: 'var(--muted)' }}>Completed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--grad-teal)' }} />
          <span style={{ color: 'var(--muted)' }}>Current</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--teal)', background: 'white' }} />
          <span style={{ color: 'var(--muted)' }}>Available</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#f3f4f6', border: '2px solid var(--border)' }} />
          <span style={{ color: 'var(--muted)' }}>Locked</span>
        </div>
      </div>
    </div>
  )
}
