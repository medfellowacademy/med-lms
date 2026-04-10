'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

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
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>Courses</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Manage all courses and their modules</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '9px 18px', background: 'var(--teal)', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
          }}
        >
          + New Course
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 20, marginBottom: 20
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>Create New Course</h3>
          <form onSubmit={createCourse}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Course Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="e.g. Cardiology Fellowship"
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                  borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif"
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief course description..."
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                  borderRadius: 7, fontSize: 13, outline: 'none', resize: 'vertical',
                  fontFamily: "'DM Sans', sans-serif"
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: '8px 20px', background: 'var(--teal)', color: 'white',
                  border: 'none', borderRadius: 7, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif"
                }}
              >
                {creating ? 'Creating…' : 'Create Course'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '8px 20px', background: 'transparent', color: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif"
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Course List */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: 20 }}>Loading courses…</div>
      ) : courses.length === 0 ? (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 40, textAlign: 'center'
        }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No courses yet. Create your first course above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {courses.map(course => (
            <div
              key={course.id}
              style={{
                background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
                padding: 20, display: 'flex', flexDirection: 'column', gap: 12
              }}
            >
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{course.title}</h3>
                {course.description && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{course.description}</p>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Created {new Date(course.created_at).toLocaleDateString()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => router.push(`/admin/courses/${course.id}`)}
                  style={{
                    flex: 1, padding: '8px 0', background: 'var(--teal-light)', color: 'var(--teal)',
                    border: '1px solid #9FE1CB', borderRadius: 7, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  Manage Modules
                </button>
                <button
                  onClick={() => deleteCourse(course.id)}
                  disabled={deleting === course.id}
                  style={{
                    padding: '8px 14px', background: 'transparent', color: '#ef4444',
                    border: '1px solid #fecaca', borderRadius: 7, fontSize: 12,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  {deleting === course.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
