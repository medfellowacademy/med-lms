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
  category: string
  created_at: string
  moduleCount: number
  contentCount: number
}

interface Stats {
  totalCourses: number
  totalModules: number
  totalContent: number
  categoryBreakdown: Record<string, number>
}

const CATEGORIES = [
  'All',
  'Cardiology',
  'Surgery',
  'Gynecology & Obstetrics',
  'Pediatrics',
  'Internal Medicine',
  'Emergency & Critical Care',
  'Oncology',
  'Specialty Medicine',
  'Radiology & Imaging',
  'Orthopedics & Surgery',
  'Other Specialties'
]

export default function ContentManagerPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [courses, setCourses] = useState<Course[]>([])
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'delete' | 'lock' | 'unlock' | null>(null)
  const [processing, setProcessing] = useState(false)

  async function loadData() {
    setLoading(true)
    
    // Fetch courses with stats
    const coursesRes = await fetch('/api/content-manager')
    const coursesData = await coursesRes.json()
    
    // Fetch statistics
    const statsRes = await fetch('/api/content-manager?action=stats')
    const statsData = await statsRes.json()
    
    setCourses(coursesData.courses || [])
    setFilteredCourses(coursesData.courses || [])
    setStats(statsData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // Filter courses
  useEffect(() => {
    let filtered = courses

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(c => c.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      )
    }

    setFilteredCourses(filtered)
  }, [courses, selectedCategory, searchQuery])

  function toggleCourseSelection(courseId: string) {
    const newSelected = new Set(selectedCourses)
    if (newSelected.has(courseId)) {
      newSelected.delete(courseId)
    } else {
      newSelected.add(courseId)
    }
    setSelectedCourses(newSelected)
  }

  function selectAll() {
    if (selectedCourses.size === filteredCourses.length) {
      setSelectedCourses(new Set())
    } else {
      setSelectedCourses(new Set(filteredCourses.map(c => c.id)))
    }
  }

  async function executeBulkAction(action: 'delete' | 'lock' | 'unlock') {
    if (selectedCourses.size === 0) return
    
    const actionText = action === 'delete' 
      ? `delete ${selectedCourses.size} course(s) and all their content` 
      : `${action} all modules in ${selectedCourses.size} course(s)`
    
    if (!confirm(`Are you sure you want to ${actionText}?`)) return

    setProcessing(true)
    setBulkAction(action)

    const response = await fetch('/api/content-manager', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        courseIds: Array.from(selectedCourses)
      })
    })

    if (response.ok) {
      setSelectedCourses(new Set())
      await loadData()
    } else {
      const error = await response.json()
      alert('Error: ' + error.error)
    }

    setProcessing(false)
    setBulkAction(null)
  }

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      'Cardiology': { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
      'Surgery': { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd' },
      'Gynecology & Obstetrics': { bg: '#fdf4ff', text: '#c026d3', border: '#f0abfc' },
      'Pediatrics': { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
      'Internal Medicine': { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
      'Emergency & Critical Care': { bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
      'Oncology': { bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff' },
      'Specialty Medicine': { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
      'Radiology & Imaging': { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
      'Orthopedics & Surgery': { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
      'Other Specialties': { bg: '#f5f5f5', text: '#737373', border: '#e5e5e5' }
    }
    return colors[category] || { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' }
  }

  return (
    <div className="page-pad" style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Content Manager</h1>
        <p className="page-subtitle">Manage all course content across specialties</p>
      </div>

      {/* Statistics Dashboard */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 16, 
          marginBottom: 24 
        }}>
          <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.totalCourses}</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Total Courses</div>
          </div>
          <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.totalModules}</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Total Modules</div>
          </div>
          <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.totalContent}</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Content Files</div>
          </div>
          <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>
              {Object.keys(stats.categoryBreakdown).length}
            </div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>Categories</div>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div style={{ 
        background: 'var(--white)', 
        border: '1px solid var(--border)', 
        borderRadius: 10, 
        padding: 20,
        marginBottom: 20
      }}>
        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Search courses by name or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input"
            style={{ fontSize: 14 }}
          />
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                border: selectedCategory === cat ? '2px solid var(--teal)' : '1px solid var(--border)',
                background: selectedCategory === cat ? 'var(--teal-soft)' : 'var(--white)',
                color: selectedCategory === cat ? 'var(--teal)' : 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'DM Sans', sans-serif"
              }}
            >
              {cat}
              {cat !== 'All' && stats?.categoryBreakdown[cat] && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  ({stats.categoryBreakdown[cat]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {selectedCourses.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {selectedCourses.size} selected
            </span>
            <button
              onClick={() => executeBulkAction('delete')}
              disabled={processing}
              className="btn btn-sm"
              style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
            >
              {processing && bulkAction === 'delete' ? 'Deleting...' : 'Delete Selected'}
            </button>
            <button
              onClick={() => executeBulkAction('lock')}
              disabled={processing}
              className="btn btn-sm"
              style={{ background: '#fff7ed', color: '#ea580c', borderColor: '#fed7aa' }}
            >
              {processing && bulkAction === 'lock' ? 'Locking...' : 'Lock Modules'}
            </button>
            <button
              onClick={() => executeBulkAction('unlock')}
              disabled={processing}
              className="btn btn-sm"
              style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}
            >
              {processing && bulkAction === 'unlock' ? 'Unlocking...' : 'Unlock Modules'}
            </button>
            <button
              onClick={() => setSelectedCourses(new Set())}
              className="btn btn-ghost btn-sm"
            >
              Clear Selection
            </button>
          </motion.div>
        )}
      </div>

      {/* Select All */}
      {filteredCourses.length > 0 && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={selectedCourses.size === filteredCourses.length && filteredCourses.length > 0}
            onChange={selectAll}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Select all {filteredCourses.length} course(s)
          </span>
        </div>
      )}

      {/* Courses Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card" style={{ padding: 20, height: 200 }}>
              <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 20 }} />
              <div className="skeleton" style={{ height: 36, width: '100%' }} />
            </div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🔍</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No courses found</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
            {searchQuery ? 'Try a different search term' : 'Try selecting a different category'}
          </p>
        </div>
      ) : (
        <StaggerGrid style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredCourses.map(course => {
            const badge = getCategoryBadgeColor(course.category)
            const isSelected = selectedCourses.has(course.id)

            return (
              <StaggerItem
                key={course.id}
                className="card card-hover"
                style={{
                  padding: 20,
                  position: 'relative',
                  border: isSelected ? '2px solid var(--teal)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--teal-soft)' : 'var(--white)'
                }}
              >
                {/* Selection Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCourseSelection(course.id)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    cursor: 'pointer',
                    width: 18,
                    height: 18
                  }}
                />

                {/* Category Badge */}
                <div
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 5,
                    marginBottom: 12,
                    background: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.border}`
                  }}
                >
                  {course.category || 'Uncategorized'}
                </div>

                {/* Title */}
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, paddingRight: 24 }}>
                  {course.title}
                </h3>

                {/* Description */}
                {course.description && (
                  <p style={{ 
                    fontSize: 12.5, 
                    color: 'var(--muted)', 
                    lineHeight: 1.5, 
                    marginBottom: 16,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {course.description}
                  </p>
                )}

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'var(--muted)' }}>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>{course.moduleCount}</strong> modules
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>{course.contentCount}</strong> files
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => router.push(`/admin/courses/${course.id}`)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => router.push(`/admin/courses/${course.id}/upload`)}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 11 }}
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => router.push(`/student/courses/${course.id}`)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                  >
                    View
                  </button>
                </div>
              </StaggerItem>
            )
          })}
        </StaggerGrid>
      )}

      {/* Results Count */}
      {!loading && filteredCourses.length > 0 && (
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          Showing {filteredCourses.length} of {courses.length} courses
        </div>
      )}
    </div>
  )
}
