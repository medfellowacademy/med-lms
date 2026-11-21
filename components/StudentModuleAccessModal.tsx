'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface Module {
  id: string
  title: string
  order_index: number
  is_locked: boolean
}

interface Student {
  id: string
  full_name: string
  email: string
}

// null = use global, true = force unlock, false = force lock
type Override = boolean | null

interface Props {
  open: boolean
  onClose: () => void
  courseId: string
  modules: Module[]
}

export default function StudentModuleAccessModal({ open, onClose, courseId, modules }: Props) {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingOverrides, setLoadingOverrides] = useState(false)

  // Load enrolled students
  useEffect(() => {
    if (!open) return
    setLoadingStudents(true)
    supabase
      .from('enrollments')
      .select('user_id, profiles!inner(id, full_name, email)')
      .eq('course_id', courseId)
      .then(({ data }) => {
        const list: Student[] = (data || []).map((row: any) => ({
          id: row.profiles.id,
          full_name: row.profiles.full_name || row.profiles.email,
          email: row.profiles.email,
        }))
        setStudents(list)
        setLoadingStudents(false)
      })
  }, [open, courseId])

  // Load overrides when a student is selected
  const loadOverrides = useCallback(async (student: Student) => {
    setLoadingOverrides(true)
    const res = await fetch(`/api/student-module-access?course_id=${courseId}&student_id=${student.id}`)
    const { data } = await res.json()
    const map: Record<string, Override> = {}
    for (const row of data || []) {
      map[row.module_id] = row.is_unlocked
    }
    setOverrides(map)
    setLoadingOverrides(false)
  }, [courseId])

  async function setOverride(moduleId: string, value: Override) {
    if (!selectedStudent) return
    setSaving(moduleId)
    if (value === null) {
      // Remove override → revert to global
      await fetch(`/api/student-module-access?student_id=${selectedStudent.id}&module_id=${moduleId}`, {
        method: 'DELETE',
      })
    } else {
      await fetch('/api/student-module-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: selectedStudent.id, module_id: moduleId, is_unlocked: value }),
      })
    }
    setOverrides(prev => ({ ...prev, [moduleId]: value }))
    setSaving(null)
  }

  function getEffectiveStatus(mod: Module): 'unlocked' | 'locked' {
    const ov = overrides[mod.id]
    if (ov === true) return 'unlocked'
    if (ov === false) return 'locked'
    return mod.is_locked ? 'locked' : 'unlocked'
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Individual Student Access</h2>
              <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                Override module access for specific students. Overrides take priority over global lock/unlock.
              </p>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Student list */}
          <div style={{
            width: 220, borderRight: '1px solid var(--border)', overflowY: 'auto',
            padding: 12, flexShrink: 0
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 4 }}>
              Enrolled Students
            </p>
            {loadingStudents ? (
              [0,1,2].map(i => (
                <div key={i} className="skeleton" style={{ height: 36, borderRadius: 8, marginBottom: 6 }} />
              ))
            ) : students.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', padding: 8 }}>No enrolled students.</p>
            ) : (
              students.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStudent(s); loadOverrides(s) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8,
                    border: '1px solid transparent', cursor: 'pointer', marginBottom: 4,
                    background: selectedStudent?.id === s.id ? 'var(--teal-soft)' : 'transparent',
                    borderColor: selectedStudent?.id === s.id ? '#9FE1CB' : 'transparent',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</p>
                </button>
              ))
            )}
          </div>

          {/* Module access panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {!selectedStudent ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--muted)' }}>
                <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.3 }}>
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                </svg>
                <p style={{ fontSize: 13 }}>Select a student to manage their access</p>
              </div>
            ) : loadingOverrides ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {modules.map(m => (
                  <div key={m.id} className="skeleton" style={{ height: 56, borderRadius: 10 }} />
                ))}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{selectedStudent.full_name}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>{selectedStudent.email}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {modules.map(mod => {
                    const ov = overrides[mod.id] ?? null
                    const effective = getEffectiveStatus(mod)
                    const isSaving = saving === mod.id
                    return (
                      <div key={mod.id} style={{
                        padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10,
                        background: effective === 'unlocked' ? 'linear-gradient(135deg, #f0fdf4, var(--white))' : 'var(--white)',
                        borderColor: effective === 'unlocked' ? '#9FE1CB' : 'var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {mod.order_index + 1}. {mod.title}
                            </p>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                                Global: <strong style={{ color: mod.is_locked ? '#ef4444' : '#10b981' }}>{mod.is_locked ? 'Locked' : 'Unlocked'}</strong>
                              </span>
                              {ov !== null && (
                                <span style={{
                                  fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                                  background: ov ? '#d1fae5' : '#fee2e2',
                                  color: ov ? '#065f46' : '#991b1b'
                                }}>
                                  Override: {ov ? 'Unlocked' : 'Locked'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              disabled={isSaving}
                              onClick={() => setOverride(mod.id, true)}
                              className="btn btn-sm"
                              style={ov === true
                                ? { background: '#10b981', color: '#fff', borderColor: '#10b981' }
                                : { background: 'var(--success-bg)', color: 'var(--success)', borderColor: '#bbf7d0' }}
                            >
                              {isSaving ? '…' : 'Unlock'}
                            </button>
                            <button
                              disabled={isSaving}
                              onClick={() => setOverride(mod.id, false)}
                              className="btn btn-sm"
                              style={ov === false
                                ? { background: '#ef4444', color: '#fff', borderColor: '#ef4444' }
                                : { background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                            >
                              {isSaving ? '…' : 'Lock'}
                            </button>
                            {ov !== null && (
                              <button
                                disabled={isSaving}
                                onClick={() => setOverride(mod.id, null)}
                                className="btn btn-ghost btn-sm"
                                title="Remove override — follow global setting"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, lineHeight: 1.6 }}>
                  <strong>Unlock</strong> — student can access this module regardless of global setting.<br/>
                  <strong>Lock</strong> — student cannot access this module even if globally unlocked.<br/>
                  <strong>Reset</strong> — removes override, falls back to global lock/unlock.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
