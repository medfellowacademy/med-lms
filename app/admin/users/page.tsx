'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
}

interface Course {
  id: string
  title: string
}

interface Enrollment {
  user_id: string
  course_id: string
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'student' | 'admin'>('student')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  async function load() {
    const [{ data: ps }, { data: cs }, { data: es }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('courses').select('id, title').order('title'),
      supabase.from('enrollments').select('*'),
    ])
    setProfiles(ps || [])
    setCourses(cs || [])
    setEnrollments(es || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function isEnrolled(userId: string, courseId: string) {
    return enrollments.some(e => e.user_id === userId && e.course_id === courseId)
  }

  async function toggleEnrollment(userId: string, courseId: string) {
    setSaving(true)
    if (isEnrolled(userId, courseId)) {
      await supabase.from('enrollments').delete().eq('user_id', userId).eq('course_id', courseId)
    } else {
      await supabase.from('enrollments').insert({ user_id: userId, course_id: courseId })
    }
    setSaving(false)
    load()
  }

  async function toggleRole(user: Profile) {
    const newRole = user.role === 'admin' ? 'student' : 'admin'
    await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    if (selectedUser?.id === user.id) setSelectedUser({ ...user, role: newRole })
    load()
  }

  async function deleteUser(userId: string) {
    if (!confirm('Delete this user? This cannot be undone.')) return
    const res = await fetch(`/api/delete-user?id=${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setSelectedUser(null)
      load()
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    setCreateSuccess('')

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        full_name: newName,
        role: newRole,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setCreateError(data.error || 'Failed to create user')
      setCreating(false)
      return
    }

    setCreateSuccess(`${newRole === 'admin' ? 'Admin' : 'Student'} account created: ${newEmail}`)
    setNewEmail('')
    setNewPassword('')
    setNewName('')
    setNewRole('student')
    setCreating(false)
    load()
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>Students & Enrollments</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Create accounts and manage course access</p>
        </div>
        <button
          onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(''); setCreateSuccess('') }}
          style={{
            padding: '9px 18px', background: 'var(--teal)', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
          }}
        >
          + Create User
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 20, marginBottom: 20
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>Create New User Account</h3>

          {createSuccess && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#15803d'
            }}>
              {createSuccess}
            </div>
          )}
          {createError && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626'
            }}>
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Full Name</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Dr. Sarah Khan"
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                    borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif"
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                  placeholder="student@hospital.com"
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                    borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif"
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Password *</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                    borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif"
                  }}
                />
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Share this password with the user</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 5 }}>Role *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['student', 'admin'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      style={{
                        flex: 1, padding: '9px 0', fontSize: 13, fontWeight: newRole === r ? 500 : 400,
                        background: newRole === r ? 'var(--teal-light)' : 'var(--bg)',
                        color: newRole === r ? 'var(--teal)' : 'var(--muted)',
                        border: `1px solid ${newRole === r ? '#9FE1CB' : 'var(--border)'}`,
                        borderRadius: 7, cursor: 'pointer', textTransform: 'capitalize',
                        fontFamily: "'DM Sans', sans-serif"
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: '9px 24px', background: 'var(--teal)', color: 'white',
                  border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500,
                  cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1,
                  fontFamily: "'DM Sans', sans-serif"
                }}
              >
                {creating ? 'Creating…' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{
                  padding: '9px 20px', background: 'transparent', color: 'var(--muted)',
                  border: '1px solid var(--border)', borderRadius: 7, fontSize: 13,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users + Enrollment */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', gap: 24 }}>
          {/* User list */}
          <div style={{ width: 300, flexShrink: 0 }}>
            <p style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
              All Users ({profiles.length})
            </p>
            {profiles.length === 0 ? (
              <div style={{
                background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8,
                padding: 24, textAlign: 'center'
              }}>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>No users yet. Create one above.</p>
              </div>
            ) : (
              profiles.map(profile => (
                <div
                  key={profile.id}
                  onClick={() => setSelectedUser(selectedUser?.id === profile.id ? null : profile)}
                  style={{
                    background: 'var(--white)',
                    border: `1px solid ${selectedUser?.id === profile.id ? 'var(--teal)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '10px 14px', marginBottom: 8, cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: 'var(--teal)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 500, color: 'white', flexShrink: 0
                    }}>
                      {(profile.full_name || profile.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {profile.full_name || '(no name)'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {profile.email}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                      background: profile.role === 'admin' ? '#fef3c7' : 'var(--teal-light)',
                      color: profile.role === 'admin' ? '#92400e' : 'var(--teal)'
                    }}>
                      {profile.role}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Enrollment panel */}
          {selectedUser ? (
            <div style={{ flex: 1 }}>
              <div style={{
                background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, padding: 20
              }}>
                {/* User header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 500 }}>{selectedUser.full_name || selectedUser.email}</h3>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{selectedUser.email}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => toggleRole(selectedUser)}
                      style={{
                        padding: '6px 14px', fontSize: 12,
                        background: selectedUser.role === 'admin' ? '#fef3c7' : '#f0fdf4',
                        color: selectedUser.role === 'admin' ? '#92400e' : '#15803d',
                        border: `1px solid ${selectedUser.role === 'admin' ? '#fde68a' : '#bbf7d0'}`,
                        borderRadius: 7, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                      }}
                    >
                      Make {selectedUser.role === 'admin' ? 'Student' : 'Admin'}
                    </button>
                  </div>
                </div>

                {/* Course Enrollments */}
                <p style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
                  Course Access
                </p>

                {courses.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>No courses created yet.</p>
                ) : (
                  courses.map(course => {
                    const enrolled = isEnrolled(selectedUser.id, course.id)
                    return (
                      <div key={course.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 0', borderBottom: '1px solid var(--border)'
                      }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>{course.title}</p>
                          <p style={{ fontSize: 11, color: enrolled ? 'var(--teal)' : 'var(--muted)', marginTop: 2 }}>
                            {enrolled ? 'Has access' : 'No access'}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleEnrollment(selectedUser.id, course.id)}
                          disabled={saving}
                          style={{
                            padding: '7px 18px', fontSize: 12, fontWeight: 500,
                            background: enrolled ? '#fef2f2' : 'var(--teal-light)',
                            color: enrolled ? '#dc2626' : 'var(--teal)',
                            border: `1px solid ${enrolled ? '#fecaca' : '#9FE1CB'}`,
                            borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer',
                            fontFamily: "'DM Sans', sans-serif"
                          }}
                        >
                          {saving ? '…' : enrolled ? 'Revoke' : 'Enroll'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
              minHeight: 200
            }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Select a user to manage their course access</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
