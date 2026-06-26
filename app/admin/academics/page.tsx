'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type CourseStatus = 'active' | 'pass' | 'fail' | 'discontinued'

interface Student {
  id: string
  full_name: string
  email: string
  role: string
  registration_number: string | null
  phone: string | null
  date_of_birth: string | null
  address: string | null
  batch_year: number | null
  created_at: string
}

interface Enrollment {
  course_id: string
  enrolled_at: string
  course_end_date: string | null
  status: CourseStatus
  courses: { id: string; title: string }
}

interface StudentDocument {
  id: string
  student_id: string
  title: string
  file_type: string
  storage_path: string
  uploaded_at: string
}

interface StudentDetail extends Student {
  enrollments: Enrollment[]
  documents: StudentDocument[]
}

interface EditForm {
  full_name: string
  phone: string
  date_of_birth: string
  address: string
  batch_year: string
  registration_number: string
}

const STATUS_CONFIG: Record<CourseStatus, { label: string; bg: string; color: string; border: string }> = {
  active:        { label: 'Active',        bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  pass:          { label: 'Pass',          bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  fail:          { label: 'Fail',          bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  discontinued:  { label: 'Discontinued', bg: '#f3f4f6', color: '#4b5563', border: '#d1d5db' },
}

export default function AcademicsPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<CourseStatus | 'all'>('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    full_name: '', phone: '', date_of_birth: '', address: '', batch_year: '', registration_number: ''
  })
  const [saving, setSaving] = useState(false)
  const [allEnrollments, setAllEnrollments] = useState<Record<string, { courseIds: string[]; statuses: CourseStatus[] }>>({})

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null)
  const [previewDocTitle, setPreviewDocTitle] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: profiles }, { data: enrollData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
      // select without status first for safety; status is added via migration
      supabase.from('enrollments').select('user_id, course_id, status'),
    ])
    setStudents(profiles || [])
    const map: Record<string, { courseIds: string[]; statuses: CourseStatus[] }> = {}
    for (const e of (enrollData || [])) {
      if (!map[e.user_id]) map[e.user_id] = { courseIds: [], statuses: [] }
      map[e.user_id].courseIds.push(e.course_id)
      map[e.user_id].statuses.push(((e as any).status as CourseStatus) || 'active')
    }
    setAllEnrollments(map)
    setLoading(false)
  }

  async function loadDetail(student: Student) {
    setLoadingDetail(true)
    setSelected({ ...student, enrollments: [], documents: [] })
    const [{ data: enrollments }, { data: documents }] = await Promise.all([
      supabase
        .from('enrollments')
        .select('course_id, enrolled_at, course_end_date, status, courses!inner(id, title)')
        .eq('user_id', student.id)
        .order('enrolled_at', { ascending: false }),
      supabase
        .from('student_documents')
        .select('*')
        .eq('student_id', student.id)
        .order('uploaded_at', { ascending: false }),
    ])
    setSelected({
      ...student,
      enrollments: (enrollments as any) || [],
      documents: documents || [],
    })
    setLoadingDetail(false)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    await supabase.from('profiles').update({
      full_name: editForm.full_name,
      phone: editForm.phone || null,
      date_of_birth: editForm.date_of_birth || null,
      address: editForm.address || null,
      batch_year: editForm.batch_year ? parseInt(editForm.batch_year) : null,
      registration_number: editForm.registration_number || null,
    }).eq('id', selected.id)
    setSaving(false)
    setEditOpen(false)
    load()
    const updated = {
      ...selected, ...editForm,
      batch_year: editForm.batch_year ? parseInt(editForm.batch_year) : null
    }
    setSelected(updated as any)
  }

  async function setEndDate(courseId: string, endDate: string) {
    if (!selected) return
    await supabase.from('enrollments')
      .update({ course_end_date: endDate || null })
      .eq('user_id', selected.id).eq('course_id', courseId)
    loadDetail(selected)
  }

  async function setCourseStatus(courseId: string, status: CourseStatus) {
    if (!selected) return
    await supabase.from('enrollments')
      .update({ status })
      .eq('user_id', selected.id).eq('course_id', courseId)
    // Optimistic update
    setSelected(prev => prev ? {
      ...prev,
      enrollments: prev.enrollments.map(e =>
        e.course_id === courseId ? { ...e, status } : e
      )
    } : prev)
  }

  async function uploadDocument() {
    if (!selected || !docFile || !docTitle.trim()) return
    setUploadingDoc(true)
    const ext = docFile.name.split('.').pop()
    const path = `student-docs/${selected.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('medfellow-content')
      .upload(path, docFile)
    if (uploadErr) { alert('Upload failed: ' + uploadErr.message); setUploadingDoc(false); return }
    await supabase.from('student_documents').insert({
      student_id: selected.id,
      title: docTitle.trim(),
      file_type: ext || 'file',
      storage_path: path,
    })
    setDocTitle('')
    setDocFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploadingDoc(false)
    loadDetail(selected)
  }

  async function deleteDocument(doc: StudentDocument) {
    if (!confirm(`Delete "${doc.title}"?`)) return
    setDeletingDoc(doc.id)
    await supabase.storage.from('medfellow-content').remove([doc.storage_path])
    await supabase.from('student_documents').delete().eq('id', doc.id)
    setDeletingDoc(null)
    setSelected(prev => prev ? { ...prev, documents: prev.documents.filter(d => d.id !== doc.id) } : prev)
  }

  async function previewDocument(doc: StudentDocument) {
    const { data } = await supabase.storage.from('medfellow-content').createSignedUrl(doc.storage_path, 3600)
    if (data?.signedUrl) { setPreviewDocUrl(data.signedUrl); setPreviewDocTitle(doc.title) }
  }

  useEffect(() => { load() }, [])

  // Overall status badge: worst status across all enrollments
  function overallStatus(studentId: string): CourseStatus {
    const statuses = (allEnrollments[studentId]?.statuses || [])
    if (statuses.includes('discontinued')) return 'discontinued'
    if (statuses.includes('fail')) return 'fail'
    if (statuses.includes('pass') && !statuses.includes('active')) return 'pass'
    return 'active'
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchText = !q ||
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.registration_number?.toLowerCase().includes(q) ||
      s.batch_year?.toString().includes(q)
    const matchStatus = filterStatus === 'all' || overallStatus(s.id) === filterStatus
    return matchText && matchStatus
  })

  // Count by overall status
  const counts = { active: 0, pass: 0, fail: 0, discontinued: 0 }
  for (const s of students) counts[overallStatus(s.id)]++

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{ width: 300, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button onClick={() => router.push('/admin/users')} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
            </button>
            <div>
              <h1 style={{ fontSize: 14, fontWeight: 700 }}>Academics</h1>
              <p style={{ fontSize: 10.5, color: 'var(--muted)' }}>{students.length} students</p>
            </div>
          </div>

          {/* Status filter chips */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {(['all', 'active', 'pass', 'fail', 'discontinued'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 20, border: '1px solid',
                  cursor: 'pointer', fontWeight: 600,
                  background: filterStatus === s
                    ? (s === 'all' ? 'var(--teal)' : STATUS_CONFIG[s]?.bg || '#e5e7eb')
                    : 'transparent',
                  color: filterStatus === s
                    ? (s === 'all' ? '#fff' : STATUS_CONFIG[s]?.color || '#374151')
                    : 'var(--muted)',
                  borderColor: filterStatus === s
                    ? (s === 'all' ? 'var(--teal)' : STATUS_CONFIG[s]?.border || '#d1d5db')
                    : 'var(--border)',
                }}
              >
                {s === 'all' ? `All (${students.length})` : `${STATUS_CONFIG[s].label} (${counts[s]})`}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, reg no..."
            className="input"
            style={{ width: '100%', fontSize: 12 }}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No students found.</div>
          ) : (
            filtered.map(s => {
              const st = overallStatus(s.id)
              const cfg = STATUS_CONFIG[st]
              return (
                <button
                  key={s.id}
                  onClick={() => loadDetail(s)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: selected?.id === s.id ? 'var(--teal-soft)' : 'transparent',
                    borderLeft: selected?.id === s.id ? '3px solid var(--teal)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: cfg.bg, color: cfg.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, border: `1.5px solid ${cfg.border}`
                    }}>
                      {(s.full_name || s.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {s.full_name || '(No name)'}
                        </p>
                        <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 10, background: cfg.bg, color: cfg.color, fontWeight: 700, flexShrink: 0 }}>
                          {cfg.label}
                        </span>
                      </div>
                      <p style={{ fontSize: 10.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                        {s.registration_number || 'No reg no'} · {(allEnrollments[s.id]?.courseIds || []).length} course{(allEnrollments[s.id]?.courseIds || []).length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--muted)' }}>
            <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.2 }}>
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            <p style={{ fontSize: 14 }}>Select a student to view their academic profile</p>
          </div>
        ) : (
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 22px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'var(--grad-teal)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, flexShrink: 0
                }}>
                  {(selected.full_name || selected.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.full_name || '(No name)'}</h2>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#dbeafe', color: '#1d4ed8' }}>
                      {selected.registration_number || 'No Reg No'}
                    </span>
                    {selected.batch_year && (
                      <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 20, background: '#fef3c7', color: '#92400e' }}>
                        Batch {selected.batch_year}
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      Joined {new Date(selected.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditForm({
                    full_name: selected.full_name || '',
                    phone: selected.phone || '',
                    date_of_birth: selected.date_of_birth || '',
                    address: selected.address || '',
                    batch_year: selected.batch_year?.toString() || '',
                    registration_number: selected.registration_number || '',
                  })
                  setEditOpen(true)
                }}
                className="btn btn-secondary btn-sm"
              >
                Edit Profile
              </button>
            </div>

            {/* Personal Info */}
            <div className="card" style={{ padding: 18, marginBottom: 14 }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                Personal Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                <InfoField label="Email" value={selected.email} />
                <InfoField label="Phone" value={selected.phone || '—'} />
                <InfoField label="Date of Birth" value={selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                <InfoField label="Batch Year" value={selected.batch_year?.toString() || '—'} />
                <InfoField label="Registration No." value={selected.registration_number || '—'} />
                <InfoField label="Address" value={selected.address || '—'} />
              </div>
            </div>

            {/* Enrolled Courses with status */}
            <div className="card" style={{ padding: 18, marginBottom: 14 }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                Enrolled Courses
              </h3>
              {loadingDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
                </div>
              ) : selected.enrollments.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Not enrolled in any courses.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.enrollments.map((en: any) => {
                    const course = en.courses
                    const status: CourseStatus = en.status || 'active'
                    const cfg = STATUS_CONFIG[status]
                    const startDate = new Date(en.enrolled_at)
                    const endDate = en.course_end_date ? new Date(en.course_end_date) : null
                    return (
                      <div key={en.course_id} style={{
                        padding: '14px 16px', border: `1px solid ${cfg.border}`, borderRadius: 10,
                        background: cfg.bg + '55',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                              <p style={{ fontSize: 13.5, fontWeight: 600 }}>{course?.title || 'Unknown Course'}</p>
                              {/* Status selector */}
                              <div style={{ display: 'flex', gap: 4 }}>
                                {(['active', 'pass', 'fail', 'discontinued'] as CourseStatus[]).map(s => {
                                  const c = STATUS_CONFIG[s]
                                  return (
                                    <button
                                      key={s}
                                      onClick={() => setCourseStatus(en.course_id, s)}
                                      style={{
                                        fontSize: 10, padding: '2px 8px', borderRadius: 12, cursor: 'pointer',
                                        fontWeight: 700, border: `1.5px solid ${c.border}`,
                                        background: status === s ? c.bg : 'transparent',
                                        color: status === s ? c.color : 'var(--muted)',
                                        opacity: status === s ? 1 : 0.6,
                                      }}
                                    >
                                      {c.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                <strong style={{ color: 'var(--text)' }}>Start:</strong> {startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                <strong style={{ color: 'var(--text)' }}>End:</strong>{' '}
                                {endDate ? endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Ongoing'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                            <input
                              type="date"
                              defaultValue={en.course_end_date || ''}
                              onBlur={e => setEndDate(en.course_id, e.target.value)}
                              className="input"
                              style={{ fontSize: 12, padding: '4px 8px', width: 136 }}
                              title="Set end date"
                            />
                            <button
                              onClick={() => router.push(`/admin/progress?student=${selected.id}&course=${en.course_id}`)}
                              className="btn btn-sm"
                              style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', whiteSpace: 'nowrap' }}
                            >
                              Progress
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Documents section */}
            <div className="card" style={{ padding: 18, marginBottom: 14 }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                Documents
              </h3>

              {/* Upload form */}
              <div style={{
                padding: '14px 16px', border: '1.5px dashed var(--border)', borderRadius: 10,
                background: '#fafafa', marginBottom: 14
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Upload New Document</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Document Title</label>
                    <input
                      value={docTitle}
                      onChange={e => setDocTitle(e.target.value)}
                      placeholder="e.g. ID Proof, Certificate, Marksheet"
                      className="input"
                      style={{ width: '100%', fontSize: 12 }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>File (PDF, JPG, PNG, DOCX)</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.xls"
                      onChange={e => setDocFile(e.target.files?.[0] || null)}
                      className="input"
                      style={{ fontSize: 12, padding: '5px 8px' }}
                    />
                  </div>
                  <button
                    onClick={uploadDocument}
                    disabled={uploadingDoc || !docTitle.trim() || !docFile}
                    className="btn btn-primary btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {uploadingDoc ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>

              {/* Document list */}
              {loadingDetail ? (
                <div className="skeleton" style={{ height: 48, borderRadius: 8 }} />
              ) : selected.documents.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
                  No documents uploaded yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.documents.map(doc => {
                    const ext = doc.file_type.toUpperCase()
                    const extColor: Record<string, string> = { PDF: '#be185d', JPG: '#7c3aed', JPEG: '#7c3aed', PNG: '#0369a1', DOCX: '#1d4ed8', DOC: '#1d4ed8', XLSX: '#065f46', XLS: '#065f46' }
                    const color = extColor[ext] || '#374151'
                    return (
                      <div key={doc.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
                        background: 'var(--white)'
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 7, background: color + '18',
                          color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, flexShrink: 0
                        }}>
                          {ext.slice(0, 4)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.title}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {new Date(doc.uploaded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => previewDocument(doc)} className="btn btn-secondary btn-sm">
                            View
                          </button>
                          <button
                            onClick={() => deleteDocument(doc)}
                            disabled={deletingDoc === doc.id}
                            className="btn btn-danger-ghost btn-sm"
                          >
                            {deletingDoc === doc.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              <StatCard label="Total Courses" value={selected.enrollments.length.toString()} color="#dbeafe" text="#1d4ed8" />
              <StatCard label="Passed" value={selected.enrollments.filter((e: any) => e.status === 'pass').length.toString()} color="#d1fae5" text="#065f46" />
              <StatCard label="Failed" value={selected.enrollments.filter((e: any) => e.status === 'fail').length.toString()} color="#fee2e2" text="#991b1b" />
              <StatCard label="Discontinued" value={selected.enrollments.filter((e: any) => e.status === 'discontinued').length.toString()} color="#f3f4f6" text="#4b5563" />
              <StatCard label="Documents" value={selected.documents.length.toString()} color="#fef3c7" text="#92400e" />
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }} onClick={e => { if (e.target === e.currentTarget) setEditOpen(false) }}>
          <div style={{
            background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 520,
            padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Edit Academic Profile</h2>
              <button onClick={() => setEditOpen(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="Full Name" value={editForm.full_name} onChange={v => setEditForm(f => ({ ...f, full_name: v }))} />
              <FormField label="Registration Number" value={editForm.registration_number} onChange={v => setEditForm(f => ({ ...f, registration_number: v }))} placeholder="e.g. MF-2024-0001" />
              <FormField label="Phone" value={editForm.phone} onChange={v => setEditForm(f => ({ ...f, phone: v }))} placeholder="+91 xxxxx xxxxx" />
              <FormField label="Date of Birth" value={editForm.date_of_birth} onChange={v => setEditForm(f => ({ ...f, date_of_birth: v }))} type="date" />
              <FormField label="Batch Year" value={editForm.batch_year} onChange={v => setEditForm(f => ({ ...f, batch_year: v }))} placeholder="e.g. 2024" type="number" />
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Address</label>
                <textarea
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="input" rows={3}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Student address"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditOpen(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document preview modal */}
      {previewDocUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16
        }} onClick={e => { if (e.target === e.currentTarget) { setPreviewDocUrl(null) } }}>
          <div style={{
            background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 900,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{previewDocTitle}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={previewDocUrl} download target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Download</a>
                <button onClick={() => setPreviewDocUrl(null)} className="btn btn-ghost btn-sm">✕</button>
              </div>
            </div>
            <iframe
              src={previewDocUrl}
              style={{ flex: 1, border: 'none', minHeight: 500 }}
              title={previewDocTitle}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-word' }}>{value}</p>
    </div>
  )
}

function StatCard({ label, value, color, text }: { label: string; value: string; color: string; text: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: color }}>
      <p style={{ fontSize: 20, fontWeight: 800, color: text }}>{value}</p>
      <p style={{ fontSize: 11, fontWeight: 500, color: text, opacity: 0.75, marginTop: 2 }}>{label}</p>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="input" style={{ width: '100%' }}
      />
    </div>
  )
}
