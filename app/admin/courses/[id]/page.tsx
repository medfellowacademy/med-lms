'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import PreviewModal from '@/components/PreviewModal'
import CreateAnnouncementModal from '@/components/CreateAnnouncementModal'

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

interface Assessment {
  id: string
  module_id: string
  title: string
  type: 'quiz' | 'assignment' | 'exam'
  published: boolean
  due_date: string | null
}

export default function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [courseName, setCourseName] = useState('')
  const [modules, setModules] = useState<Module[]>([])
  const [content, setContent] = useState<Record<string, Content[]>>({})
  const [assessments, setAssessments] = useState<Record<string, Assessment[]>>({})
  const [courseEbooks, setCourseEbooks] = useState<CourseEbook[]>([])
  const [loading, setLoading] = useState(true)
  const [newModTitle, setNewModTitle] = useState('')
  const [addingMod, setAddingMod] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deletingEbook, setDeletingEbook] = useState<string | null>(null)
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false)
  const [allCourses, setAllCourses] = useState<{ id: string; title: string }[]>([])
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
    const [{ data: course }, { data: mods }, { data: ebooks }, { data: courses }] = await Promise.all([
      supabase.from('courses').select('title').eq('id', courseId).single(),
      supabase.from('modules').select('*').eq('course_id', courseId).order('order_index'),
      supabase.from('course_ebooks').select('*').eq('course_id', courseId).order('created_at'),
      supabase.from('courses').select('id, title').order('title'),
    ])
    setCourseName(course?.title || '')
    setModules(mods || [])
    setAllCourses(courses || [])
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

      // load assessments for all modules
      const { data: assessmentData } = await supabase
        .from('assessments')
        .select('id, module_id, title, type, published, due_date')
        .in('module_id', mods.map(m => m.id))
        .order('created_at', { ascending: false })
      const byModuleAssessment: Record<string, Assessment[]> = {}
      for (const item of assessmentData || []) {
        if (!byModuleAssessment[item.module_id]) byModuleAssessment[item.module_id] = []
        byModuleAssessment[item.module_id].push(item)
      }
      setAssessments(byModuleAssessment)
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
    <div className="page-pad" style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/admin/courses')} className="btn btn-ghost btn-sm">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
          </svg>
          Back
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="page-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loading ? '…' : courseName}
          </h1>
          <p className="page-subtitle">Modules, sub-topics, content and course e-books</p>
        </div>
        <button 
          onClick={() => setAnnouncementModalOpen(true)}
          className="btn btn-primary btn-sm"
        >
          📢 Create Announcement
        </button>
      </div>

      <CreateAnnouncementModal
        open={announcementModalOpen}
        onClose={() => setAnnouncementModalOpen(false)}
        courses={allCourses}
        defaultCourseId={courseId}
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="card card-pad">
              <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stack-sm" style={{ display: 'flex', gap: 24 }}>
          {/* Modules list */}
          <div style={{ flex: 1 }}>
            <div className="card" style={{
              padding: 18, marginBottom: 20,
              background: 'linear-gradient(180deg, #fffbeb 0%, var(--white) 60%)',
              borderColor: '#fde68a'
            }}>
              <div className="stack-sm" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: courseEbooks.length > 0 ? 14 : 6 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, background: '#fef3c7',
                    color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>Course E-Books</h4>
                    <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, maxWidth: 460, lineHeight: 1.5 }}>
                      Upload PDFs once per course. Students can access them without attaching to a module.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/admin/courses/${courseId}/upload?scope=course-ebook`)}
                  className="btn btn-sm"
                  style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}
                >
                  + Upload E-Book
                </button>
              </div>

              {courseEbooks.length === 0 ? null : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {courseEbooks.map(ebook => (
                    <div key={ebook.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10,
                      background: 'var(--white)', gap: 10, flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 7, background: '#fce7f3', color: '#be185d',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, flexShrink: 0
                        }}>
                          PDF
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ebook.title}</p>
                          <p style={{ fontSize: 11, color: 'var(--muted)' }}>Course-level e-book</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => previewEbook(ebook)} className="btn btn-secondary btn-sm">
                          Preview
                        </button>
                        <button
                          onClick={() => deleteCourseEbook(ebook)}
                          disabled={deletingEbook === ebook.id}
                          className="btn btn-danger-ghost btn-sm"
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
              <div className="empty-state" style={{ marginBottom: 20 }}>
                <div className="emoji">
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0L10 9.586l3.293-3.293a1 1 0 111.414 1.414L11.414 11l3.293 3.293a1 1 0 01-1.414 1.414L10 12.414l-3.293 3.293a1 1 0 01-1.414-1.414L8.586 11 5.293 7.707a1 1 0 010-1.414z"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No modules yet</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Add your first module below to get started.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {modules.map(mod => {
                  const modContent = content[mod.id] || []
                  const modAssessments = assessments[mod.id] || []
                  const isExpanded = expanded === mod.id
                  return (
                    <div key={mod.id} className="card" style={{
                      overflow: 'hidden',
                      borderColor: mod.is_locked ? 'var(--border)' : '#9FE1CB',
                      background: mod.is_locked ? 'var(--white)' : 'linear-gradient(180deg, var(--teal-soft) 0%, var(--white) 50%)'
                    }}>
                      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: mod.is_locked ? '#f3f4f6' : 'var(--grad-teal)',
                          color: mod.is_locked ? '#9ca3af' : 'white',
                          fontSize: 12, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {mod.order_index + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <p style={{ fontSize: 14, fontWeight: 600 }}>{mod.title}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                              {modContent.length} item{modContent.length !== 1 ? 's' : ''} • {modAssessments.length} assessment{modAssessments.length !== 1 ? 's' : ''}
                            </span>
                            <span className={mod.is_locked ? 'chip chip-neutral' : 'chip chip-success'} style={{ padding: '2px 8px', fontSize: 10.5 }}>
                              {mod.is_locked ? 'Locked' : 'Unlocked'}
                            </span>
                          </div>
                        </div>
                        <div className="module-toolbar" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => setExpanded(isExpanded ? null : mod.id)} className="btn btn-ghost btn-sm">
                            {isExpanded ? 'Hide' : 'Content'}
                          </button>
                          <button
                            onClick={() => router.push(`/admin/courses/${courseId}/modules/${mod.id}/subtopics`)}
                            className="btn btn-sm"
                            style={{ background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' }}
                          >
                            Sub-topics
                          </button>
                          <button
                            onClick={() => router.push(`/admin/assessments/new?module_id=${mod.id}&course_id=${courseId}`)}
                            className="btn btn-sm"
                            style={{ background: '#faf5ff', color: '#7c3aed', borderColor: '#e9d5ff' }}
                          >
                            + Assessment
                          </button>
                          <button
                            onClick={() => router.push(`/admin/courses/${courseId}/upload?module=${mod.id}`)}
                            className="btn btn-secondary btn-sm"
                          >
                            Upload
                          </button>
                          <button
                            onClick={() => toggleLock(mod)}
                            disabled={toggling === mod.id}
                            className="btn btn-sm"
                            style={mod.is_locked
                              ? { background: 'var(--success-bg)', color: 'var(--success)', borderColor: '#bbf7d0' }
                              : { background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                          >
                            {toggling === mod.id ? '…' : mod.is_locked ? 'Unlock' : 'Lock'}
                          </button>
                          <button onClick={() => deleteModule(mod.id)} className="btn btn-danger-ghost btn-sm" aria-label="Delete module">
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Content and Assessments list */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
                          {/* Content Section */}
                          <div style={{ marginBottom: modAssessments.length > 0 ? 16 : 0 }}>
                            <h5 style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content</h5>
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
                              modContent.map((item, idx) => {
                                const icon = typeIcon(item.type)
                                return (
                                  <div key={item.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 2px', borderBottom: idx === modContent.length - 1 ? 'none' : '1px solid var(--border)',
                                    gap: 10, flexWrap: 'wrap'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                      <div style={{
                                        width: 30, height: 30, background: icon.bg, borderRadius: 7,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9.5, fontWeight: 700, color: icon.color, flexShrink: 0
                                      }}>
                                        {icon.label}
                                      </div>
                                      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button onClick={() => previewContent(item)} className="btn btn-secondary btn-sm">
                                        Preview
                                      </button>
                                      <button onClick={() => deleteContent(item.id)} className="btn btn-danger-ghost btn-sm">
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                )
                              })
                            )}
                          </div>
                          
                          {/* Assessments Section */}
                          {modAssessments.length > 0 && (
                            <div>
                              <h5 style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assessments</h5>
                              {modAssessments.map((assessment, idx) => (
                                <div key={assessment.id} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '10px 2px', borderBottom: idx === modAssessments.length - 1 ? 'none' : '1px solid var(--border)',
                                  gap: 10, flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                    <div style={{
                                      width: 30, height: 30, background: '#faf5ff', borderRadius: 7,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9.5, fontWeight: 700, color: '#7c3aed', flexShrink: 0
                                    }}>
                                      {assessment.type === 'quiz' ? 'QZ' : assessment.type === 'exam' ? 'EX' : 'AS'}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <span style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assessment.title}</span>
                                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                                        <span className={assessment.published ? 'chip chip-success' : 'chip chip-neutral'} style={{ fontSize: 10, padding: '1px 6px' }}>
                                          {assessment.published ? 'Published' : 'Draft'}
                                        </span>
                                        {assessment.due_date && (
                                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                            Due: {new Date(assessment.due_date).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => router.push(`/admin/assessments/${assessment.id}`)} className="btn btn-secondary btn-sm">
                                      Edit
                                    </button>
                                    <button onClick={async () => {
                                      if (!confirm('Delete this assessment?')) return
                                      await fetch(`/api/assessments?id=${assessment.id}`, { method: 'DELETE' })
                                      load()
                                    }} className="btn btn-danger-ghost btn-sm">
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add module form */}
            <div className="card" style={{ padding: 18 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Add New Module</h4>
              <form onSubmit={addModule} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  value={newModTitle}
                  onChange={e => setNewModTitle(e.target.value)}
                  required
                  placeholder="Module title (e.g. ECG Interpretation)"
                  className="input"
                  style={{ flex: 1, minWidth: 220 }}
                />
                <button type="submit" disabled={addingMod} className="btn btn-primary">
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
