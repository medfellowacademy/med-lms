'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import PreviewModal from '@/components/PreviewModal'

interface ContentItem {
  id: string
  title: string
  type: 'video' | 'ppt' | 'pdf' | 'audio' | 'document'
  storagePath: string
  approvalStatus: 'pending' | 'approved' | 'rejected'
  createdAt: string
  approvedAt?: string
  rejectionReason?: string
  fileSize?: number
  mimeType?: string
  module: { id: string; title: string }
  course: { id: string; title: string }
  subTopic?: { id: string; title: string } | null
  uploadedBy?: { id: string; name: string; email: string } | null
  approvedBy?: { id: string; name: string } | null
}

export default function ContentReviewPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')

  async function loadContent() {
    setLoading(true)
    const response = await fetch(`/api/content-approval?status=${filter}`)
    const data = await response.json()
    setContent(data.content || [])
    setSelectedItems(new Set())
    setLoading(false)
  }

  useEffect(() => { loadContent() }, [filter])

  function toggleSelection(id: string) {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  function selectAll() {
    if (selectedItems.size === content.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(content.map(c => c.id)))
    }
  }

  async function handleApprove() {
    if (selectedItems.size === 0) return
    if (!confirm(`Approve ${selectedItems.size} item(s)? They will be visible to students.`)) return

    setProcessing(true)
    const response = await fetch('/api/content-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        contentIds: Array.from(selectedItems)
      })
    })

    if (response.ok) {
      const data = await response.json()
      alert(data.message)
      await loadContent()
    } else {
      const error = await response.json()
      alert('Error: ' + error.error)
    }

    setProcessing(false)
  }

  async function handleReject() {
    if (selectedItems.size === 0) return
    setShowRejectModal(true)
  }

  async function confirmReject() {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }

    setProcessing(true)
    const response = await fetch('/api/content-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject',
        contentIds: Array.from(selectedItems),
        rejectionReason: rejectionReason.trim()
      })
    })

    if (response.ok) {
      const data = await response.json()
      alert(data.message)
      setShowRejectModal(false)
      setRejectionReason('')
      await loadContent()
    } else {
      const error = await response.json()
      alert('Error: ' + error.error)
    }

    setProcessing(false)
  }

  async function handleDelete() {
    if (selectedItems.size === 0) return
    if (!confirm(`Delete ${selectedItems.size} item(s) permanently? This cannot be undone.`)) return

    setProcessing(true)
    const response = await fetch('/api/content-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        contentIds: Array.from(selectedItems)
      })
    })

    if (response.ok) {
      const data = await response.json()
      alert(data.message)
      await loadContent()
    } else {
      const error = await response.json()
      alert('Error: ' + error.error)
    }

    setProcessing(false)
  }

  async function handlePreview(item: ContentItem) {
    const { data } = await supabase.storage
      .from('medfellow-content')
      .createSignedUrl(item.storagePath, 3600)
    
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl)
      setPreviewItem(item)
    }
  }

  async function handleDownload(item: ContentItem) {
    const { data } = await supabase.storage
      .from('medfellow-content')
      .createSignedUrl(item.storagePath, 60)
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const getTypeIcon = (type: string) => {
    const icons: Record<string, { icon: string; bg: string; color: string }> = {
      video: { icon: '▶', bg: '#fef3c7', color: '#d97706' },
      ppt: { icon: '📊', bg: '#fee2e2', color: '#dc2626' },
      pdf: { icon: '📄', bg: '#dbeafe', color: '#2563eb' },
      audio: { icon: '🎵', bg: '#fce7f3', color: '#db2777' },
      document: { icon: '📝', bg: '#e0e7ff', color: '#6366f1' }
    }
    return icons[type] || icons.document
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return mb > 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
  }

  return (
    <div className="page-pad" style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Content Review & Approval</h1>
        <p className="page-subtitle">Review and approve content before publishing to students</p>
      </div>

      {/* Filter Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginBottom: 20,
        borderBottom: '2px solid var(--border)',
        paddingBottom: 0
      }}>
        {(['pending', 'approved', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: filter === tab ? 'var(--teal)' : 'var(--muted)',
              borderBottom: filter === tab ? '3px solid var(--teal)' : '3px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {tab} ({content.length})
          </button>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      {selectedItems.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {selectedItems.size} selected
          </span>
          
          {filter === 'pending' && (
            <>
              <button
                onClick={handleApprove}
                disabled={processing}
                className="btn btn-sm"
                style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}
              >
                ✓ Approve
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="btn btn-sm"
                style={{ background: '#fff7ed', color: '#ea580c', borderColor: '#fed7aa' }}
              >
                ✗ Reject
              </button>
            </>
          )}
          
          <button
            onClick={handleDelete}
            disabled={processing}
            className="btn btn-sm"
            style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
          >
            🗑 Delete
          </button>
          
          <button
            onClick={() => setSelectedItems(new Set())}
            className="btn btn-ghost btn-sm"
          >
            Clear
          </button>
        </motion.div>
      )}

      {/* Select All */}
      {content.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={selectedItems.size === content.length}
            onChange={selectAll}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Select all {content.length} item(s)
          </span>
        </div>
      )}

      {/* Content List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="card" style={{ padding: 20, height: 120 }}>
              <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
            </div>
          ))}
        </div>
      ) : content.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📦</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
            No {filter} content
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
            {filter === 'pending' 
              ? 'All content has been reviewed'
              : filter === 'approved'
              ? 'No approved content yet'
              : 'No rejected content'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {content.map(item => {
            const typeInfo = getTypeIcon(item.type)
            const isSelected = selectedItems.has(item.id)

            return (
              <motion.div
                key={item.id}
                className="card"
                style={{
                  padding: 20,
                  border: isSelected ? '2px solid var(--teal)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--teal-soft)' : 'var(--white)'
                }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(item.id)}
                    style={{ marginTop: 4, cursor: 'pointer' }}
                  />

                  {/* Type Icon */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: typeInfo.bg,
                      color: typeInfo.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0
                    }}
                  >
                    {typeInfo.icon}
                  </div>

                  {/* Content Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                      {item.title}
                    </h3>
                    
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                      <strong>{item.course.title}</strong> → {item.module.title}
                      {item.subTopic && <> → {item.subTopic.title}</>}
                    </div>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
                      <div>Type: <strong style={{ color: 'var(--text)' }}>{item.type.toUpperCase()}</strong></div>
                      <div>Size: <strong style={{ color: 'var(--text)' }}>{formatFileSize(item.fileSize)}</strong></div>
                      <div>Uploaded: <strong style={{ color: 'var(--text)' }}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </strong></div>
                      {item.uploadedBy && (
                        <div>By: <strong style={{ color: 'var(--text)' }}>{item.uploadedBy.name}</strong></div>
                      )}
                    </div>

                    {item.rejectionReason && (
                      <div style={{
                        marginTop: 8,
                        padding: 10,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#dc2626'
                      }}>
                        <strong>Rejection Reason:</strong> {item.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handlePreview(item)}
                      className="btn btn-ghost btn-sm"
                      title="Preview"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => handleDownload(item)}
                      className="btn btn-ghost btn-sm"
                      title="Download"
                    >
                      ⬇️
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 9998
              }}
              onClick={() => setShowRejectModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--white)',
                borderRadius: 12,
                padding: 24,
                maxWidth: 500,
                width: '90%',
                zIndex: 9999,
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
                Reject Content
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Please provide a reason for rejecting {selectedItems.size} item(s):
              </p>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g., Poor quality, incorrect content, copyright issues..."
                className="textarea"
                rows={4}
                style={{ marginBottom: 16 }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectionReason('')
                  }}
                  className="btn btn-ghost"
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  className="btn btn-primary"
                  disabled={processing || !rejectionReason.trim()}
                  style={{ background: '#ea580c' }}
                >
                  {processing ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      {previewItem && (
        <PreviewModal
          isOpen={!!previewItem}
          onClose={() => {
            setPreviewItem(null)
            setPreviewUrl('')
          }}
          title={previewItem.title}
          type={previewItem.type === 'document' ? 'pdf' : previewItem.type}
          url={previewUrl}
        />
      )}
    </div>
  )
}
