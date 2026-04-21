'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import PreviewModal from '@/components/PreviewModal'

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

interface CourseEbook {
  id: string
  course_id: string
  title: string
  storage_path: string
}

export default function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [courseName, setCourseName] = useState('')
  const [modules, setModules] = useState<Module[]>([])
  const [content, setContent] = useState<Record<string, Content[]>>({})
  const [courseEbooks, setCourseEbooks] = useState<CourseEbook[]>([])
  const [loading, setLoading] = useState(true)
  const [newModTitle, setNewModTitle] = useState('')
  const [addingMod, setAddingMod] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deletingEbook, setDeletingEbook] = useState<string | null>(null)
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean
    title: string
    type: 'video' | 'ppt' | 'pdf'
    url: string
  }>({
    isOpen: false,
    title: '',
    type: 'video',
    url: '',
  })

  async function load() {
    const [{ data: course }, { data: mods }, { data: ebooks }] = await Promise.all([
      supabase.from('courses').select('title').eq('id', courseId).single(),
      supabase.from('modules').select('*').eq('course_id', courseId).order('order_index'),
      supabase.from('course_ebooks').select('*').eq('course_id', courseId).order('created_at'),
    ])
    setCourseName(course?.title || '')
    setModules(mods || [])
    setCourseEbooks(ebooks || [])

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

  async function previewContent(item: Content) {
    // Get signed URL from Supabase storage
    const { data } = await supabase.storage
      .from('medfellow-content')
      .createSignedUrl(item.storage_path, 3600) // 1 hour expiry

    if (data?.signedUrl) {
      setPreviewModal({
        isOpen: true,
        title: item.title,
        type: item.type,
        url: data.signedUrl,
      })
    } else {
      alert('Failed to load preview URL')
    }
  }

  async function previewEbook(ebook: CourseEbook) {
    const { data } = await supabase.storage
      .from('medfellow-content')
      .createSignedUrl(ebook.storage_path, 3600)

    if (data?.signedUrl) {
      setPreviewModal({
        isOpen: true,
        title: ebook.title,
        type: 'pdf',
        url: data.signedUrl,
      })
    } else {
      alert('Failed to load preview URL')
    }
  }

  async function deleteCourseEbook(ebook: CourseEbook) {
    if (!confirm('Delete this course e-book?')) return
    setDeletingEbook(ebook.id)
    await supabase.storage.from('medfellow-content').remove([ebook.storage_path])
    await supabase.from('course_ebooks').delete().eq('id', ebook.id)
    setDeletingEbook(null)
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
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Module management, content, and course e-books</p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Modules list */}
          <div style={{ flex: 1 }}>
            <div style={{
              background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
              padding: 16, marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 500 }}>Course E-Books</h4>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    Upload PDFs once per course. Students can access them without attaching them to a module.
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/admin/courses/${courseId}/upload?scope=course-ebook`)}
                  style={{
                    padding: '8px 12px', fontSize: 12, background: '#fef3c7', color: '#92400e',
                    border: '1px solid #fcd34d', borderRadius: 7, cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  + Upload E-Book
                </button>
              </div>

              {courseEbooks.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>No course e-books uploaded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {courseEbooks.map(ebook => (
                    <div key={ebook.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
                      background: '#fffdf8'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6, background: '#fce7f3', color: '#be185d',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700
                        }}>
                          PDF
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 500 }}>{ebook.title}</p>
                          <p style={{ fontSize: 11, color: 'var(--muted)' }}>Course-level e-book</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={() => previewEbook(ebook)}
                          style={{
                            padding: '5px 12px',
                            fontSize: 11,
                            background: 'var(--teal-light)',
                            color: 'var(--teal)',
                            border: '1px solid #9FE1CB',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          👁 Preview
                        </button>
                        <button
                          onClick={() => deleteCourseEbook(ebook)}
                          disabled={deletingEbook === ebook.id}
                          style={{
                            padding: '5px 10px', fontSize: 11, background: 'transparent',
                            color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif"
                          }}
                        >
                          {deletingEbook === ebook.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <button
                                      onClick={() => previewContent(item)}
                                      style={{
                                        fontSize: 11,
                                        color: 'var(--teal)',
                                        background: 'transparent',
                                        border: '1px solid #9FE1CB',
                                        cursor: 'pointer',
                                        padding: '4px 10px',
                                        borderRadius: 5,
                                        fontFamily: "'DM Sans', sans-serif",
                                      }}
                                    >
                                      👁 Preview
                                    </button>
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

      {/* Preview Modal */}
      <PreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ ...previewModal, isOpen: false })}
        title={previewModal.title}
        type={previewModal.type}
        url={previewModal.url}
      />
    </div>
  )
}
