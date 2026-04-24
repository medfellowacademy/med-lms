'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Module {
  id: string
  title: string
}

interface SubTopic {
  id: string
  module_id: string
  title: string
}

export default function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedModule = searchParams.get('module') || ''
  const preselectedSubTopic = searchParams.get('subtopic') || ''
  const preselectedScope = searchParams.get('scope') === 'course-ebook' ? 'course-ebook' : 'module'

  const supabase = createClient()
  const [modules, setModules] = useState<Module[]>([])
  const [subTopics, setSubTopics] = useState<SubTopic[]>([])
  const [uploadTarget, setUploadTarget] = useState<'module' | 'course-ebook'>(preselectedScope)
  const [selectedModule, setSelectedModule] = useState(preselectedModule)
  const [selectedSubTopic, setSelectedSubTopic] = useState(preselectedSubTopic)
  const [contentType, setContentType] = useState<'video' | 'ppt' | 'pdf'>(preselectedScope === 'course-ebook' ? 'pdf' : 'video')
  const [contentTitle, setContentTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('modules').select('id, title').eq('course_id', courseId).order('order_index')
      .then(({ data }) => {
        setModules(data || [])
        if (!preselectedModule && data && data.length > 0) {
          setSelectedModule(data[0].id)
        }
      })
  }, [courseId])

  // Load sub-topics when module changes
  useEffect(() => {
    if (uploadTarget === 'course-ebook') {
      setContentType('pdf')
      setSelectedSubTopic('')
    }
  }, [uploadTarget])

  useEffect(() => {
    if (selectedModule) {
      supabase.from('sub_topics')
        .select('id, module_id, title')
        .eq('module_id', selectedModule)
        .order('order_index')
        .then(({ data }) => {
          setSubTopics(data || [])
          if (!preselectedSubTopic && data && data.length > 0) {
            setSelectedSubTopic(data[0].id)
          } else if (!data || data.length === 0) {
            setSelectedSubTopic('')
          }
        })
    } else {
      setSubTopics([])
      setSelectedSubTopic('')
    }
  }, [selectedModule])

  const acceptMap = {
    video: 'video/*',
    ppt: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
  }

  const folderMap = {
    video: 'videos',
    ppt: 'ppts',
    pdf: 'pdfs',
  }

  // File size limits (in bytes)
  const MAX_FILE_SIZE = {
    video: 1024 * 1024 * 1024, // 1GB (1024MB) for videos
    ppt: 100 * 1024 * 1024,    // 100MB for presentations
    pdf: 50 * 1024 * 1024,     // 50MB for PDFs
  }

  function validateFile(file: File, type: 'video' | 'ppt' | 'pdf'): string | null {
    // Check file size
    if (file.size > MAX_FILE_SIZE[type]) {
      const maxMB = MAX_FILE_SIZE[type] / 1024 / 1024
      return `File too large. Maximum size for ${type} is ${maxMB}MB.`
    }

    // Check file type
    const validTypes = {
      video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'],
      ppt: [
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ],
      pdf: ['application/pdf'],
    }

    if (!validTypes[type].includes(file.type)) {
      return `Invalid file type. Please upload a valid ${type.toUpperCase()} file.`
    }

    return null
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !contentTitle.trim()) return
    if (uploadTarget === 'module' && !selectedModule) return

    // Validate file
    const validationError = validateFile(file, contentType)
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(true)
    setError('')
    setSuccess(false)
    setProgress(10)

    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storageFolder = uploadTarget === 'course-ebook' ? 'course-ebooks' : folderMap[contentType]
  const storagePath = `${storageFolder}/${fileName}`

    setProgress(30)
    const { error: storageError } = await supabase.storage
      .from('medfellow-content')
      .upload(storagePath, file)

    if (storageError) {
      setError('Upload failed: ' + storageError.message)
      setUploading(false)
      setProgress(0)
      return
    }

    setProgress(80)
    let dbError: { message: string } | null = null

    if (uploadTarget === 'course-ebook') {
      const { error } = await supabase.from('course_ebooks').insert({
        course_id: courseId,
        title: contentTitle.trim(),
        storage_path: storagePath,
      })
      dbError = error
    } else {
      const insertData: any = {
        module_id: selectedModule,
        type: contentType,
        title: contentTitle.trim(),
        storage_path: storagePath,
        order_index: 0,
      }

      if (selectedSubTopic) {
        insertData.sub_topic_id = selectedSubTopic
      }

      const { error } = await supabase.from('module_content').insert(insertData)
      dbError = error
    }

    if (dbError) {
      setError('Failed to save record: ' + dbError.message)
      setUploading(false)
      setProgress(0)
      return
    }

    setProgress(100)
    setSuccess(true)
    setContentTitle('')
    setFile(null)
    setUploading(false)

    // Reset progress after a moment
    setTimeout(() => setProgress(0), 2000)
  }

  return (
    <div className="page-pad" style={{ padding: 24, maxWidth: 600 }}>
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
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>Upload Content</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {uploadTarget === 'course-ebook'
              ? 'Upload a PDF that belongs to the whole course'
              : 'Add videos, presentations, or PDFs to a module'}
          </p>
        </div>
      </div>

      <div style={{
        background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, padding: 24
      }}>
        {success && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#15803d'
          }}>
            {uploadTarget === 'course-ebook' ? 'Course e-book uploaded successfully!' : 'Content uploaded successfully!'}
          </div>
        )}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Upload To</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { value: 'course-ebook', label: 'Course E-Book' },
                { value: 'module', label: 'Module Content' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUploadTarget(option.value as 'module' | 'course-ebook')}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: uploadTarget === option.value ? 500 : 400,
                    background: uploadTarget === option.value ? 'var(--teal-light)' : 'var(--bg)',
                    color: uploadTarget === option.value ? 'var(--teal)' : 'var(--muted)',
                    border: `1px solid ${uploadTarget === option.value ? '#9FE1CB' : 'var(--border)'}`,
                    borderRadius: 7, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {uploadTarget === 'module' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Module *</label>
              <select
                value={selectedModule}
                onChange={e => setSelectedModule(e.target.value)}
                required
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                  borderRadius: 7, fontSize: 13, outline: 'none', background: 'white',
                  fontFamily: "'DM Sans', sans-serif"
                }}
              >
                <option value="">Select a module…</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}

          {uploadTarget === 'module' && subTopics.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Sub-Topic (Optional)
              </label>
              <select
                value={selectedSubTopic}
                onChange={e => setSelectedSubTopic(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                  borderRadius: 7, fontSize: 13, outline: 'none', background: 'white',
                  fontFamily: "'DM Sans', sans-serif"
                }}
              >
                <option value="">No sub-topic (attach to module directly)</option>
                {subTopics.map(st => (
                  <option key={st.id} value={st.id}>{st.title}</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Select a sub-topic to organize content, or leave blank to attach directly to the module
              </p>
            </div>
          )}

          {uploadTarget === 'module' ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Content Type *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['video', 'ppt', 'pdf'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setContentType(type)}
                    style={{
                      flex: 1, padding: '9px 0', fontSize: 13, fontWeight: contentType === type ? 500 : 400,
                      background: contentType === type ? 'var(--teal-light)' : 'var(--bg)',
                      color: contentType === type ? 'var(--teal)' : 'var(--muted)',
                      border: `1px solid ${contentType === type ? '#9FE1CB' : 'var(--border)'}`,
                      borderRadius: 7, cursor: 'pointer', textTransform: 'uppercase',
                      fontFamily: "'DM Sans', sans-serif"
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              marginBottom: 16, padding: '10px 12px', borderRadius: 8,
              border: '1px solid #fbcfe8', background: '#fdf2f8', fontSize: 12, color: '#9d174d'
            }}>
              Course e-books are stored as PDF resources at the course level.
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Title *</label>
            <input
              value={contentTitle}
              onChange={e => setContentTitle(e.target.value)}
              required
              placeholder={uploadTarget === 'course-ebook' ? 'e.g. Cardiology Handbook' : 'e.g. Lecture 2.1 - Normal Sinus Rhythm'}
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                borderRadius: 7, fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif"
              }}
            />
          </div>

          {/* File picker */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>File *</label>
            <div style={{
              border: '2px dashed var(--border)', borderRadius: 8, padding: 24,
              textAlign: 'center', background: 'var(--bg)'
            }}>
              <input
                type="file"
                accept={acceptMap[contentType]}
                onChange={e => setFile(e.target.files?.[0] || null)}
                required
                style={{ display: 'none' }}
                id="file-input"
              />
              <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
                {file ? (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--teal)' }}>{file.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB / {MAX_FILE_SIZE[contentType] / 1024 / 1024}MB max
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Click to choose a {contentType === 'video' ? 'video' : contentType.toUpperCase()} file
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                      {contentType === 'video' ? 'MP4, MOV, AVI' : contentType === 'ppt' ? 'PPT, PPTX' : 'PDF'} · Max {MAX_FILE_SIZE[contentType] / 1024 / 1024}MB
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Progress */}
          {uploading && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ background: '#e5e7eb', borderRadius: 4, height: 4 }}>
                <div style={{ background: 'var(--teal)', height: 4, borderRadius: 4, width: `${progress}%`, transition: 'width 0.3s' }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Uploading… {progress}%</p>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            style={{
              width: '100%', padding: '11px 0', background: 'var(--teal)', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
              cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1,
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            {uploading ? 'Uploading…' : uploadTarget === 'course-ebook' ? 'Upload E-Book' : 'Upload Content'}
          </button>
        </form>
      </div>
    </div>
  )
}
