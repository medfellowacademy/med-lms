'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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
  courses: { id: string; title: string }
}

interface StudentDetail extends Student {
  enrollments: Enrollment[]
}

interface EditForm {
  full_name: string
  phone: string
  date_of_birth: string
  address: string
  batch_year: string
  registration_number: string
}

export default function AcademicsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [students, setStudents] = useState<Student[]>([])
  const [selected, setSelected] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({ full_name: '', phone: '', date_of_birth: '', address: '', batch_year: '', registration_number: '' })
  const [saving, setSaving] = useState(false)
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([])
  const [allEnrollments, setAllEnrollments] = useState<Record<string, string[]>>({}) // studentId → courseIds

  async function load() {
    setLoading(true)
    const [{ data: profiles }, { data: courseList }, { data: enrollData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
      supabase.from('courses').select('id, title').order('title'),
      supabase.from('enrollments').select('user_id, course_id'),
    ])
    setStudents(profiles || [])
    setCourses(courseList || [])
    const map: Record<string, string[]> = {}
    for (const e of enrollData || []) {
      if (!map[e.user_id]) map[e.user_id] = []
      map[e.user_id].push(e.course_id)
    }
    setAllEnrollments(map)
    setLoading(false)
  }

  async function loadDetail(student: Student) {
    setLoadingDetail(true)
    setSelected({ ...student, enrollments: [] })
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id, enrolled_at, course_end_date, courses(id, title)')
      .eq('user_id', student.id)
      .order('enrolled_at', { ascending: false })
    setSelected({ ...student, enrollments: (enrollments as any) || [] })
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
    const updated = { ...selected, ...editForm, batch_year: editForm.batch_year ? parseInt(editForm.batch_year) : null }
    setSelected(updated as any)
  }

  async function setEndDate(courseId: string, endDate: string) {
    if (!selected) return
    await supabase.from('enrollments')
      .update({ course_end_date: endDate || null })
      .eq('user_id', selected.id)
      .eq('course_id', courseId)
    loadDetail(selected)
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    return !q ||
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.registration_number?.toLowerCase().includes(q) ||
      s.batch_year?.toString().includes(q)
  })

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left panel — student list */}
      <div style={{
        width: 320, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button onClick={() => router.push('/admin/users')} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
            </button>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 700 }}>Academics</h1>
              <p style={{ fontSize: 11, color: 'var(--muted)' }}>{students.length} students registered</p>
            </div>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, reg no..."
            className="input"
            style={{ width: '100%', fontSize: 13 }}
          />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No students found.</div>
          ) : (
            filtered.map(s => (
              <button
                key={s.id}
                onClick={() => loadDetail(s)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: selected?.id === s.id ? 'var(--teal-soft)' : 'transparent',
                  borderLeft: selected?.id === s.id ? '3px solid var(--teal)' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--grad-teal)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700
                  }}>
                    {(s.full_name || s.email || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.full_name || '(No name)'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.registration_number || 'No reg no'} · {(allEnrollments[s.id] || []).length} course{(allEnrollments[s.id] || []).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel — student detail */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--muted)' }}>
            <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.2 }}>
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
            <p style={{ fontSize: 14 }}>Select a student to view their academic profile</p>
          </div>
        ) : (
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              gap: 16, marginBottom: 24, flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'var(--grad-teal)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 700, flexShrink: 0
                }}>
                  {(selected.full_name || selected.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                    {selected.full_name || '(No name)'}
                  </h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: '#dbeafe', color: '#1d4ed8'
                    }}>
                      {selected.registration_number || 'No Reg No'}
                    </span>
                    {selected.batch_year && (
                      <span style={{
                        fontSize: 12, padding: '3px 10px', borderRadius: 20,
                        background: '#fef3c7', color: '#92400e'
                      }}>
                        Batch {selected.batch_year}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
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

            {/* Personal Info Card */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                Personal Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                <InfoField label="Email" value={selected.email} />
                <InfoField label="Phone" value={selected.phone || '—'} />
                <InfoField label="Date of Birth" value={selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'} />
                <InfoField label="Batch Year" value={selected.batch_year?.toString() || '—'} />
                <InfoField label="Registration No." value={selected.registration_number || '—'} />
                <InfoField label="Address" value={selected.address || '—'} />
              </div>
            </div>

            {/* Enrolled Courses */}
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                Enrolled Courses
              </h3>
              {loadingDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}
                </div>
              ) : selected.enrollments.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Not enrolled in any courses.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.enrollments.map((en: any) => {
                    const course = en.courses
                    const startDate = new Date(en.enrolled_at)
                    const endDate = en.course_end_date ? new Date(en.course_end_date) : null
                    const isActive = !endDate || endDate >= new Date()
                    return (
                      <div key={en.course_id} style={{
                        padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10,
                        background: isActive ? 'linear-gradient(135deg, #f0fdf4, var(--white))' : 'var(--white)',
                        borderColor: isActive ? '#9FE1CB' : 'var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                              <p style={{ fontSize: 14, fontWeight: 600 }}>{course?.title || 'Unknown Course'}</p>
                              <span style={{
                                fontSize: 10.5, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                                background: isActive ? '#d1fae5' : '#f3f4f6',
                                color: isActive ? '#065f46' : '#6b7280'
                              }}>
                                {isActive ? 'Active' : 'Completed'}
                              </span>
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
                              style={{ fontSize: 12, padding: '4px 8px', width: 140 }}
                              title="Set course end date"
                            />
                            <button
                              onClick={() => router.push(`/admin/progress?student=${selected.id}&course=${en.course_id}`)}
                              className="btn btn-sm"
                              style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', whiteSpace: 'nowrap' }}
                            >
                              View Progress
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              <StatCard label="Total Courses" value={(selected.enrollments || []).length.toString()} color="#dbeafe" text="#1d4ed8" />
              <StatCard label="Active Courses" value={(selected.enrollments || []).filter((e: any) => !e.course_end_date || new Date(e.course_end_date) >= new Date()).length.toString()} color="#d1fae5" text="#065f46" />
              <StatCard label="Member Since" value={new Date(selected.created_at).getFullYear().toString()} color="#fef3c7" text="#92400e" />
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
                  className="input"
                  rows={3}
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
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-word' }}>{value}</p>
    </div>
  )
}

function StatCard({ label, value, color, text }: { label: string; value: string; color: string; text: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: color }}>
      <p style={{ fontSize: 22, fontWeight: 800, color: text }}>{value}</p>
      <p style={{ fontSize: 11.5, fontWeight: 500, color: text, opacity: 0.75, marginTop: 2 }}>{label}</p>
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
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
        style={{ width: '100%' }}
      />
    </div>
  )
}
