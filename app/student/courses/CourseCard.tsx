'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

interface CourseCardProps {
  course: {
    id: string
    title: string
    description: string
  }
  counts: {
    total: number
    unlocked: number
  }
}

export default function CourseCard({ course, counts }: CourseCardProps) {
  const pct = counts.total === 0 ? 0 : Math.round((counts.unlocked / counts.total) * 100)
  return (
    <Link href={`/student/courses/${course.id}`} style={{ textDecoration: 'none' }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="card card-hover"
        style={{
          padding: 20,
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'var(--grad-teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(15, 110, 86, 0.25)',
            flexShrink: 0
          }}>
            <svg width="19" height="19" viewBox="0 0 20 20" fill="white">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {course.title}
            </h3>
            {course.description && (
              <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                {course.description}
              </p>
            )}
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
            <span style={{ color: 'var(--muted)' }}>{counts.unlocked} of {counts.total} unlocked</span>
            <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{pct}%</span>
          </div>
          <div className="progress">
            <div className={`bar ${pct === 100 ? 'bar-done' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}
