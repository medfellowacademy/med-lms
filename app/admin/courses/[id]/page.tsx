'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Module {
  id: string
  title: string
  order_index: number
  is_locked: boolean
}

interface Content {
  id: string
  module_id: string
  type: 'video' | 'ppt' | 'pdf'
  title: string
  storage_path: string
  order_index: number
}

export default function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [courseName, setCourseName] = useState('')
  const [modules, setModules] = useState<Module[]>([])
  const [content, setContent] = useState<Record<string, Content[]>>({})
  const [loading, setLoading] = useState(true)
  const [newModTitle, setNewModTitle] = useState('')
  const [addingMod, setAddingMod] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    const [{ data: course }, { data: mods }] = await Promise.all([
      supabase.from('courses').select('title').eq('id', courseId).single(),
      supabase.from('modules').select('*').eq('course_id', courseId).order('order_index'),
    ])
    setCourseName(course?.title || '')
    setModules(mods || [])

    // load content for all modules
    if (mods && mods.length > 0) {
      const { data: items } = await supabase
        .from('module_content')
        .select('*')
        .in('module_id', mods.map(m => m.id))
        .order('order_index')
      const byModule: Record<string, Content[]> = {}
      for (const item of items || []) {
        if (!byModule[item.module_id]) byModule[item.module_id] = []
        byModule[item.module_id].push(item)
      }
      setContent(byModule)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [courseId])

  async function addModule(e: React.FormEvent) {
    e.preventDefault()
    if (!newModTitle.trim()) return
    setAddingMod(true)
    const nextIndex = modules.length
    await supabase.from('modules').insert({
      course_id: courseId,
      title: newModTitle.trim(),
      order_index: nextIndex,
      is_locked: true
    })
    setNewModTitle('')
    setAddingMod(false)
    load()
  }

  async function toggleLock(mod: Module) {
    setToggling(mod.id)
    await supabase.from('modules').update({ is_locked: !mod.is_locked }).eq('id', mod.id)
    setToggling(null)
    load()
  }

  async function deleteModule(id: string) {
    if (!confirm('Delete this module and all its content?')) return
    await supabase.from('modules').delete().eq('id', id)
    load()
  }

  async function deleteContent(id: string) {
    await supabase.from('module_content').delete().eq('id', id)
    load()
  }

  const typeIcon = (type: string) => {
    if (type === 'video') return { bg: '#e0f2fe', color: '#0369a1', label: 'VID' }
    if (type === 'ppt') return { bg: '#fff3e0', color: '#e65100', label: 'PPT' }
    return { bg: '#fce4ec', color: '#c62828', label: 'PDF' }
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/admin/courses')}
          style={{
            padding: '6px 12px', background: 'var(--white)', border: '1px solid var(--border)',
            borderRadius: 7, fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif"
          }}
        >
          ← Back
        </button>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>
            {loading ? '…' : courseName}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Module management & content</p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Modules list */}
          <div style={{ flex: 1 }}>
            {modules.length === 0 ? (
              <div style={{
                background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
                padding: 32, textAlign: 'center', marginBottom: 20
              }}>
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>No modules yet. Add your first module below.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {modules.map(mod => {
                  const modContent = content[mod.id] || []
                  const isExpanded = expanded === mod.id
                  return (
                    <div key={mod.id} style={{
                      background: 'var(--white)', border: `1px solid ${mod.is_locked ? 'var(--border)' : 'var(--teal)'}`,
                      borderRadius: 10, overflow: 'hidden'
                    }}>
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: mod.is_locked ? '#f3f4f6' : 'var(--teal)',
                          color: mod.is_locked ? '#9ca3af' : 'white',
                          fontSize: 11, fontWeight: 500,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {mod.order_index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>{mod.title}</p>
                          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                            {modContent.length} item{modContent.length !== 1 ? 's' : ''}
                            {' · '}
                            <span style={{ color: mod.is_locked ? '#ef4444' : 'var(--teal)' }}>
                              {mod.is_locked ? 'Locked' : 'Unlocked'}
                            </span>
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => setExpanded(isExpanded ? null : mod.id)}
                            style={{
                              padding: '5px 10px', fontSize: 11, background: 'var(--bg)',
                              border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
                              fontFamily: "'DM Sans', sans-serif"
                            }}
                          >
                            {isExpanded ? 'Hide' : 'Content'}
                          </button>
                          <button
                            onClick={() => router.push(`/admin/courses/${courseId}/modules/${mod.id}/subtopics`)}
                            style={{
                              padding: '5px 10px', fontSize: 11, background: '#f0f9ff',
                              color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 6, cursor: 'pointer',
                              fontFamily: "'DM Sans', sans-serif"
                            }}
                          >
                            Sub-topics
                          </button>
                          <button
                            onClick={() => router.push(`/admin/courses/${courseId}/upload?module=${mod.id}`)}
                            style={{
                              padding: '5px 10px', fontSize: 11, background: 'var(--teal-light)',
                              color: 'var(--teal)', border: '1px solid #9FE1CB', borderRadius: 6, cursor: 'pointer',
                              fontFamily: "'DM Sans', sans-serif"
                            }}
                          >
                            Upload
                          </button>
                          <button
                            onClick={() => toggleLock(mod)}
                            disabled={toggling === mod.id}
                            style={{
                              padding: '5px 12px', fontSize: 11, fontWeight: 500,
                              background: mod.is_locked ? '#dcfce7' : '#fef2f2',
                              color: mod.is_locked ? '#16a34a' : '#dc2626',
                              border: `1px solid ${mod.is_locked ? '#bbf7d0' : '#fecaca'}`,
                              borderRadius: 6, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                            }}
                          >
                            {toggling === mod.id ? '…' : mod.is_locked ? '🔒 Unlock' : '🔓 Lock'}
                          </button>
                          <button
                            onClick={() => deleteModule(mod.id)}
                            style={{
                              padding: '5px 10px', fontSize: 11, background: 'transparent',
                              color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer',
                              fontFamily: "'DM Sans', sans-serif"
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Content list */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
                          {modContent.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>
                              No content yet.{' '}
                              <span
                                onClick={() => router.push(`/admin/courses/${courseId}/upload?module=${mod.id}`)}
                                style={{ color: 'var(--teal)', cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                Upload content
                              </span>
                            </p>
                          ) : (
                            modContent.map(item => {
                              const icon = typeIcon(item.type)
                              return (
                                <div key={item.id} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '7px 0', borderBottom: '1px solid var(--border)'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{
                                      width: 26, height: 26, background: icon.bg, borderRadius: 4,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9, fontWeight: 600, color: icon.color
                                    }}>
                                      {icon.label}
                                    </div>
                                    <span style={{ fontSize: 12 }}>{item.title}</span>
                                  </div>
                                  <button
                                    onClick={() => deleteContent(item.id)}
                                    style={{
                                      fontSize: 11, color: '#ef4444', background: 'transparent',
                                      border: 'none', cursor: 'pointer', padding: '2px 6px'
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add module form */}
            <div style={{
              background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, padding: 16
            }}>
              <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Add New Module</h4>
              <form onSubmit={addModule} style={{ display: 'flex', gap: 10 }}>
                <input
                  value={newModTitle}
                  onChange={e => setNewModTitle(e.target.value)}
                  required
                  placeholder="Module title (e.g. ECG Interpretation)"
                  style={{
                    flex: 1, padding: '9px 12px', border: '1px solid var(--border)',
                    borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif"
                  }}
                />
                <button
                  type="submit"
                  disabled={addingMod}
                  style={{
                    padding: '9px 20px', background: 'var(--teal)', color: 'white',
                    border: 'none', borderRadius: 7, fontSize: 13, cursor: addingMod ? 'not-allowed' : 'pointer',
                    opacity: addingMod ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  {addingMod ? '…' : '+ Add'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
