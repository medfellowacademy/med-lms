'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

interface Course {
  id: string
  title: string
}

interface CreateAnnouncementModalProps {
  open: boolean
  onClose: () => void
  courses: Course[]
  defaultCourseId?: string | null
}

export default function CreateAnnouncementModal({
  open,
  onClose,
  courses,
  defaultCourseId
}: CreateAnnouncementModalProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    course_id: defaultCourseId || '',
    priority: 'normal'
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          course_id: formData.course_id || null
        })
      })

      if (!response.ok) throw new Error('Failed to create announcement')

      setFormData({ title: '', content: '', course_id: defaultCourseId || '', priority: 'normal' })
      onClose()
      router.refresh()
    } catch (err) {
      console.error('Error creating announcement:', err)
      alert('Failed to create announcement')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          borderRadius: 16,
          padding: 28,
          width: '100%',
          maxWidth: 540
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
          📢 Create Announcement
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="input"
              placeholder="Announcement title"
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Content</label>
            <textarea
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              className="textarea"
              placeholder="Announcement details..."
              rows={5}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Course (Optional)</label>
            <select
              value={formData.course_id}
              onChange={e => setFormData({ ...formData, course_id: e.target.value })}
              className="input"
            >
              <option value="">All Students (Platform-wide)</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="field-label">Priority</label>
            <select
              value={formData.priority}
              onChange={e => setFormData({ ...formData, priority: e.target.value })}
              className="input"
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Announcement'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
