'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import PreviewModal from '@/components/PreviewModal'

interface SubTopic {
  id: string
  module_id: string
  title: string
  order_index: number
  is_locked: boolean
}

interface SubTopicContent {
  id: string
  sub_topic_id: string
  type: 'video' | 'audio' | 'ppt' | 'pdf' | 'document'
  title: string
  storage_path: string
}

interface Module {
  id: string
  title: string
}

export default function ModuleSubTopicsPage({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  const { id: courseId, moduleId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [module, setModule] = useState<Module | null>(null)
  const [subTopics, setSubTopics] = useState<SubTopic[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [contentByTopic, setContentByTopic] = useState<Record<string, SubTopicContent[]>>({})
  const [preview, setPreview] = useState<{ title: string; type: SubTopicContent['type']; url: string } | null>(null)

  async function load() {
    const [{ data: mod }, { data: topics }, { data: items }] = await Promise.all([
      supabase.from('modules').select('id, title').eq('id', moduleId).single(),
      supabase.from('sub_topics').select('*').eq('module_id', moduleId).order('order_index'),
      supabase.from('module_content').select('id, sub_topic_id, type, title, storage_path').eq('module_id', moduleId).not('sub_topic_id', 'is', null).order('order_index')
    ])

    setModule(mod)
    setSubTopics(topics || [])
    const byTopic: Record<string, SubTopicContent[]> = {}
    for (const item of items || []) (byTopic[item.sub_topic_id] ||= []).push(item)
    setContentByTopic(byTopic)
    setLoading(false)
  }

  useEffect(() => { load() }, [moduleId])

  async function previewItem(item: SubTopicContent) {
    // Video/audio go through the same-origin streaming proxy (admins are always allowed)
    if (item.type === 'video' || item.type === 'audio') {
      setPreview({ title: item.title, type: item.type, url: `/api/stream/${item.id}` })
      return
    }
    const { data } = await supabase.storage.from('medfellow-content').createSignedUrl(item.storage_path, 3600)
    if (data?.signedUrl) setPreview({ title: item.title, type: item.type, url: data.signedUrl })
    else alert('Failed to load preview')
  }

  async function addSubTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)

    const nextIndex = subTopics.length
    const { error } = await supabase.from('sub_topics').insert({
      module_id: moduleId,
      title: newTitle.trim(),
      order_index: nextIndex,
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setNewTitle('')
      load()
    }
    setAdding(false)
  }

  async function deleteSubTopic(id: string) {
    if (!confirm('Delete this sub-topic and all its content?')) return
    await supabase.from('sub_topics').delete().eq('id', id)
    load()
  }

  async function toggleLock(topic: SubTopic) {
    setToggling(topic.id)
    await supabase.from('sub_topics').update({ is_locked: !topic.is_locked }).eq('id', topic.id)
    setToggling(null)
    load()
  }

  return (
    <div className="page-pad" style={{ padding: 24, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push(`/admin/courses/${courseId}`)}
          style={{
            padding: '6px 12px', background: 'var(--white)', border: '1px solid var(--border)',
            borderRadius: 7, fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif"
          }}
        >
          ← Back
        </button>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>
            {loading ? '…' : module?.title}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Manage sub-topics</p>
        </div>
      </div>

      {/* Add new sub-topic */}
      <div style={{
        background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
        padding: 20, marginBottom: 20
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add Sub-Topic</h3>
        <form onSubmit={addSubTopic} style={{ display: 'flex', gap: 10 }}>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="e.g., Organisation of Emergency Medical Services"
            required
            style={{
              flex: 1, padding: '8px 12px', border: '1px solid var(--border)',
              borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif"
            }}
          />
          <button
            type="submit"
            disabled={adding}
            style={{
              padding: '8px 20px', background: 'var(--teal)', color: 'white',
              border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
            }}
          >
            {adding ? 'Adding…' : 'Add Sub-Topic'}
          </button>
        </form>
      </div>

      {/* Sub-topics list */}
      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      ) : subTopics.length === 0 ? (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10,
          padding: 32, textAlign: 'center'
        }}>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No sub-topics yet. Add one above!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {subTopics.map((topic, index) => (
            <div
              key={topic.id}
              style={{
                background: 'var(--white)',
                border: `1px solid ${topic.is_locked ? 'var(--border)' : '#9FE1CB'}`,
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 12
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: topic.is_locked ? '#f3f4f6' : 'var(--teal-light)',
                color: topic.is_locked ? '#9ca3af' : 'var(--teal)',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500 }}>{topic.title}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  <span style={{ color: topic.is_locked ? '#ef4444' : 'var(--teal)' }}>
                    {topic.is_locked ? '🔒 Locked' : '🔓 Unlocked'}
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleLock(topic)}
                  disabled={toggling === topic.id}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    background: topic.is_locked ? '#dcfce7' : '#fef2f2',
                    color: topic.is_locked ? '#16a34a' : '#dc2626',
                    border: `1px solid ${topic.is_locked ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  {toggling === topic.id ? '...' : topic.is_locked ? 'Unlock' : 'Lock'}
                </button>
                <button
                  onClick={() => router.push(`/admin/courses/${courseId}/upload?module=${moduleId}&subtopic=${topic.id}`)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    background: 'var(--teal-light)',
                    color: 'var(--teal)',
                    border: '1px solid #9FE1CB',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  Upload Content
                </button>
                <button
                  onClick={() => deleteSubTopic(topic.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  Delete
                </button>
              </div>
              {(contentByTopic[topic.id] || []).length > 0 && (
                <div style={{ flexBasis: '100%', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {contentByTopic[topic.id].map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0' }}>
                      <span style={{ fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', marginRight: 8, textTransform: 'uppercase' }}>{item.type}</span>
                        {item.title}
                      </span>
                      <button
                        onClick={() => previewItem(item)}
                        style={{
                          padding: '4px 12px', fontSize: 12, background: 'var(--white)', color: 'var(--teal)',
                          border: '1px solid #9FE1CB', borderRadius: 6, cursor: 'pointer',
                          fontFamily: "'DM Sans', sans-serif", flexShrink: 0
                        }}
                      >
                        ▶ Preview
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {preview && (
        <PreviewModal
          isOpen
          onClose={() => setPreview(null)}
          title={preview.title}
          type={preview.type}
          url={preview.url}
        />
      )}
    </div>
  )
}
