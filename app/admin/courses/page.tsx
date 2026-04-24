'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid'

interface Course {
  id: string
  title: string
  description: string
  created_at: string
}

export default function AdminCoursesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
    setCourses(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    await supabase.from('courses').insert({ title: title.trim(), description: description.trim() })
    setTitle('')
    setDescription('')
    setShowForm(false)
    setCreating(false)
    load()
  }

  async function deleteCourse(id: string) {
    if (!confirm('Delete this course and all its modules?')) return
    setDeleting(id)
    await supabase.from('courses').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  return (
    <div className="page-pad" style={{ padding: 28 }}>
      {/* Header */}
      <div className="stack-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="page-subtitle">Manage all courses and their modules</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          {showForm ? 'Close' : 'New Course'}
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="card card-pad" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Create New Course</h3>
          <form onSubmit={createCourse}>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Course Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="e.g. Cardiology Fellowship"
                className="input"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief course description…"
                className="textarea"
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? 'Creating…' : 'Create Course'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Course List */}
      {loading ? (
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="card card-pad" style={{ height: 170 }}>
              <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: '75%', marginBottom: 24 }} />
              <div className="skeleton" style={{ height: 32, width: '100%' }} />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">
            <svg width="26" height="26" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No courses yet</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>Click “New Course” above to create your first one.</p>
        </div>
      ) : (
        <StaggerGrid className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {courses.map(course => (
            <StaggerItem
              key={course.id}
              className="card card-hover"
              style={{
                padding: 20, display: 'flex', flexDirection: 'column', gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'var(--teal-soft)', color: 'var(--teal)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>{course.title}</h3>
                  {course.description && (
                    <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{course.description}</p>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 'auto' }}>
                Created {new Date(course.created_at).toLocaleDateString()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => router.push(`/admin/courses/${course.id}`)}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                >
                  Manage Modules
                </button>
                <button
                  onClick={() => deleteCourse(course.id)}
                  disabled={deleting === course.id}
                  className="btn btn-danger-ghost btn-sm"
                  aria-label="Delete course"
                >
                  {deleting === course.id ? '…' : (
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </div>
  )
}
