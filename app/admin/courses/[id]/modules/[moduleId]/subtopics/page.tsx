'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface SubTopic {
  id: string
  module_id: string
  title: string
  order_index: number
  is_locked: boolean
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

  async function load() {
    const [{ data: mod }, { data: topics }] = await Promise.all([
      supabase.from('modules').select('id, title').eq('id', moduleId).single(),
      supabase.from('sub_topics').select('*').eq('module_id', moduleId).order('order_index')
    ])

    setModule(mod)
    setSubTopics(topics || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [moduleId])

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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
