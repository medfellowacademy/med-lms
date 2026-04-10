'use client'

import Link from 'next/link'
import { useState } from 'react'

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
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link href={`/student/courses/${course.id}`} style={{ textDecoration: 'none' }}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: 'var(--white)',
          border: `1px solid ${isHovered ? '#9FE1CB' : 'var(--border)'}`,
          borderRadius: 10,
          padding: 20,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: 'var(--teal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="white">
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
            {course.title}
          </h3>
          {course.description && (
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              {course.description}
            </p>
          )}
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--teal-light)',
          color: 'var(--teal)',
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 20,
          fontWeight: 500
        }}>
          <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {counts.unlocked} of {counts.total} modules unlocked
        </div>
      </div>
    </Link>
  )
}
