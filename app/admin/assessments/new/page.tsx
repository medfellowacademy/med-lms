'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'

interface Question {
  id?: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank'
  points: number
  options?: { text: string; is_correct: boolean }[]
  sample_answer?: string
  grading_rubric?: string
  blank_answers?: string[]
  explanation?: string
}

const CSV_OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f']

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes ("") and commas inside quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field); field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(c => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    if (row.some(c => c.trim() !== '')) rows.push(row)
  }
  return rows
}

// Expected columns (header row, any order): question_text, option_a..option_f, correct_option, points, explanation
function questionsFromCsvRows(rows: string[][]): { questions: Question[]; errors: string[] } {
  if (rows.length < 2) return { questions: [], errors: ['File needs a header row plus at least one question row.'] }

  const header = rows[0].map(h => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const idxText = col('question_text')
  const idxCorrect = col('correct_option')
  const idxPoints = col('points')
  const idxExplanation = col('explanation')
  const optionCols = CSV_OPTION_LETTERS.map(l => col(`option_${l}`)).filter(i => i !== -1)

  if (idxText === -1) return { questions: [], errors: ['Missing required column: question_text'] }
  if (optionCols.length < 2) return { questions: [], errors: ['Need at least option_a and option_b columns'] }

  const questions: Question[] = []
  const errors: string[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const rowNum = r + 1 // 1-indexed, matching what a spreadsheet shows
    const text = (row[idxText] || '').trim()
    if (!text) { errors.push(`Row ${rowNum}: missing question_text`); continue }

    const options = optionCols
      .map(ci => (row[ci] || '').trim())
      .filter(t => t !== '')

    if (options.length < 2) { errors.push(`Row ${rowNum}: needs at least 2 non-empty options`); continue }

    const correctRaw = idxCorrect !== -1 ? (row[idxCorrect] || '').trim().toLowerCase() : ''
    let correctIndex = -1
    if (/^[a-f]$/.test(correctRaw)) correctIndex = CSV_OPTION_LETTERS.indexOf(correctRaw)
    else if (/^\d+$/.test(correctRaw)) correctIndex = parseInt(correctRaw, 10) - 1
    else if (correctRaw) correctIndex = options.findIndex(o => o.toLowerCase() === correctRaw)

    if (correctIndex < 0 || correctIndex >= options.length) {
      errors.push(`Row ${rowNum}: correct_option "${row[idxCorrect] || ''}" doesn't match any option (use A, B, C…)`)
      continue
    }

    questions.push({
      question_text: text,
      question_type: 'multiple_choice',
      points: idxPoints !== -1 && row[idxPoints]?.trim() ? (parseInt(row[idxPoints], 10) || 1) : 1,
      options: options.map((o, i) => ({ text: o, is_correct: i === correctIndex })),
      explanation: idxExplanation !== -1 ? (row[idxExplanation] || '').trim() || undefined : undefined,
    })
  }

  return { questions, errors }
}

const CSV_TEMPLATE = `question_text,option_a,option_b,option_c,option_d,correct_option,points,explanation
"What is the normal resting heart rate range in a healthy adult?","40-60 bpm","60-100 bpm","100-140 bpm","140-180 bpm",B,1,"Normal adult resting heart rate is 60-100 bpm."
"Which of these is a beta-blocker?","Amlodipine","Metoprolol","Furosemide","Losartan",B,1,""
`

export default function NewAssessmentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const moduleId = searchParams.get('module_id')
  const subTopicId = searchParams.get('sub_topic_id')
  const courseId = searchParams.get('course_id')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'quiz' | 'assignment' | 'exam'>('quiz')
  const [timeLimit, setTimeLimit] = useState<number | null>(null)
  const [passingScore, setPassingScore] = useState(70)
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [showCorrect, setShowCorrect] = useState(true)
  const [shuffle, setShuffle] = useState(false)
  const [availableFrom, setAvailableFrom] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [bulkError, setBulkError] = useState('')
  const [bulkNotice, setBulkNotice] = useState('')

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: '',
      question_type: 'multiple_choice',
      points: 1,
      options: [
        { text: '', is_correct: false },
        { text: '', is_correct: false }
      ]
    }])
  }

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], ...updates }
    setQuestions(newQuestions)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const addOption = (questionIndex: number) => {
    const newQuestions = [...questions]
    if (!newQuestions[questionIndex].options) {
      newQuestions[questionIndex].options = []
    }
    newQuestions[questionIndex].options!.push({ text: '', is_correct: false })
    setQuestions(newQuestions)
  }

  const updateOption = (questionIndex: number, optionIndex: number, text: string, isCorrect: boolean) => {
    const newQuestions = [...questions]
    newQuestions[questionIndex].options![optionIndex] = { text, is_correct: isCorrect }
    setQuestions(newQuestions)
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...questions]
    newQuestions[questionIndex].options = newQuestions[questionIndex].options!.filter((_, i) => i !== optionIndex)
    setQuestions(newQuestions)
  }

  const handleBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBulkError('')
    setBulkNotice('')

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const rows = parseCsv(text)
      const { questions: parsed, errors } = questionsFromCsvRows(rows)

      if (parsed.length > 0) {
        setQuestions(prev => [...prev, ...parsed])
        setBulkNotice(`Added ${parsed.length} question${parsed.length === 1 ? '' : 's'} from the file.`)
      }
      if (errors.length > 0) {
        const shown = errors.slice(0, 8)
        setBulkError(shown.join(' · ') + (errors.length > shown.length ? ` (+${errors.length - shown.length} more)` : ''))
      }
    }
    reader.onerror = () => setBulkError('Could not read that file')
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSave = async (publish: boolean = false) => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    if (questions.length === 0) {
      setError('Add at least one question')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_id: moduleId || null,
          sub_topic_id: subTopicId || null,
          title,
          description,
          type,
          time_limit_minutes: timeLimit,
          passing_score: passingScore,
          max_attempts: maxAttempts,
          show_correct_answers: showCorrect,
          shuffle_questions: shuffle,
          available_from: availableFrom || null,
          due_date: dueDate || null,
          questions
        })
      })

      if (!res.ok) throw new Error('Failed to create assessment')

      const { assessment } = await res.json()

      // Publish if requested
      if (publish) {
        await fetch('/api/assessments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: assessment.id, published: true })
        })
      }

      // Navigate back
      if (moduleId && courseId) {
        router.push(`/admin/courses/${courseId}`)
      } else {
        router.push('/admin/courses')
      }
    } catch (err) {
      console.error(err)
      setError('Failed to save assessment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-pad" style={{ maxWidth: 900, margin: '0 auto', padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 14 }}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
          </svg>
          Back
        </button>
        <h1 className="page-title">Create {type === 'quiz' ? 'Quiz' : type === 'exam' ? 'Exam' : 'Assignment'}</h1>
        <p className="page-subtitle">Add questions and configure settings</p>
      </div>

      {error && (
        <div style={{ padding: 14, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, marginBottom: 20, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Basic Settings */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Basic Information</h3>
        
        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Assessment Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="input"
          >
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="exam">Exam</option>
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Module 1 Quiz"
            className="input"
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instructions for students..."
            className="textarea"
            rows={3}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div>
            <label className="field-label">Time Limit (minutes)</label>
            <input
              type="number"
              value={timeLimit || ''}
              onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="No limit"
              className="input"
              min="1"
            />
          </div>

          <div>
            <label className="field-label">Passing Score (%)</label>
            <input
              type="number"
              value={passingScore}
              onChange={(e) => setPassingScore(parseInt(e.target.value) || 70)}
              className="input"
              min="0"
              max="100"
            />
          </div>

          <div>
            <label className="field-label">Max Attempts</label>
            <input
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
              className="input"
              min="1"
            />
          </div>

          <div>
            <label className="field-label">Available From (optional)</label>
            <input
              type="datetime-local"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="field-label">Due Date (optional)</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          Leave "Available From" blank to open immediately once published. Leave "Due Date" blank for no deadline.
        </p>

        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCorrect}
              onChange={(e) => setShowCorrect(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Show correct answers after submission
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Shuffle question order
          </label>
        </div>
      </div>

      {/* Bulk Upload */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Bulk Upload Questions</h3>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
          Upload a CSV with columns <code>question_text, option_a, option_b, option_c, option_d, correct_option, points, explanation</code>.
          Use <code>correct_option</code> as the letter (A, B, C…) of the right answer. Only multiple-choice questions are supported via CSV.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            Choose CSV File
            <input type="file" accept=".csv,text/csv" onChange={handleBulkFile} style={{ display: 'none' }} />
          </label>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}
            download="question-template.csv"
            className="btn btn-ghost btn-sm"
          >
            Download Template
          </a>
        </div>
        {bulkNotice && (
          <p style={{ fontSize: 12.5, color: 'var(--teal)', marginTop: 10 }}>{bulkNotice}</p>
        )}
        {bulkError && (
          <p style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 10 }}>{bulkError}</p>
        )}
      </div>

      {/* Questions */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Questions ({questions.length})</h3>
          <button onClick={addQuestion} className="btn btn-primary btn-sm">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            Add Question
          </button>
        </div>

        {questions.length === 0 && (
          <div className="empty-state">
            <div className="emoji">
              <svg width="32" height="32" viewBox="0 0 20 20" fill="var(--muted)">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
            </div>
            <p>No questions yet. Click "Add Question" to get started.</p>
          </div>
        )}

        {questions.map((q, qIndex) => (
          <QuestionEditor
            key={qIndex}
            question={q}
            index={qIndex}
            onUpdate={(updates) => updateQuestion(qIndex, updates)}
            onRemove={() => removeQuestion(qIndex)}
            onAddOption={() => addOption(qIndex)}
            onUpdateOption={(optIdx, text, isCorrect) => updateOption(qIndex, optIdx, text, isCorrect)}
            onRemoveOption={(optIdx) => removeOption(qIndex, optIdx)}
          />
        ))}
      </div>

      {/* Save Buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={() => router.back()} className="btn btn-ghost" disabled={saving}>
          Cancel
        </button>
        <button onClick={() => handleSave(false)} className="btn btn-secondary" disabled={saving}>
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
        <button onClick={() => handleSave(true)} className="btn btn-primary" disabled={saving}>
          {saving ? 'Publishing...' : 'Save & Publish'}
        </button>
      </div>
    </div>
  )
}

// Question Editor Component
function QuestionEditor({
  question,
  index,
  onUpdate,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption
}: {
  question: Question
  index: number
  onUpdate: (updates: Partial<Question>) => void
  onRemove: () => void
  onAddOption: () => void
  onUpdateOption: (optIndex: number, text: string, isCorrect: boolean) => void
  onRemoveOption: (optIndex: number) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card card-pad"
      style={{ marginBottom: 14 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--teal-soft)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, color: 'var(--teal)', flexShrink: 0
          }}>
            {index + 1}
          </div>
          <select
            value={question.question_type}
            onChange={(e) => onUpdate({ question_type: e.target.value as any })}
            className="input"
            style={{ maxWidth: 180 }}
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True/False</option>
            <option value="short_answer">Short Answer</option>
            <option value="essay">Essay</option>
            <option value="fill_blank">Fill in the Blank</option>
          </select>
          <input
            type="number"
            value={question.points}
            onChange={(e) => onUpdate({ points: parseInt(e.target.value) || 1 })}
            className="input"
            style={{ width: 80 }}
            min="1"
            placeholder="Points"
          />
        </div>
        <button onClick={onRemove} className="btn btn-danger-ghost btn-sm">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          Remove
        </button>
      </div>

      <textarea
        value={question.question_text}
        onChange={(e) => onUpdate({ question_text: e.target.value })}
        placeholder="Enter your question..."
        className="textarea"
        rows={3}
        style={{ marginBottom: 14 }}
      />

      {/* Multiple Choice Options */}
      {(question.question_type === 'multiple_choice' || question.question_type === 'true_false') && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Answer Options</div>
          {question.options?.map((opt, optIdx) => (
            <div key={optIdx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                type="radio"
                checked={opt.is_correct}
                onChange={() => {
                  // Set this option as correct, others as incorrect
                  question.options?.forEach((_, i) => {
                    onUpdateOption(i, question.options![i].text, i === optIdx)
                  })
                }}
                style={{ flexShrink: 0 }}
              />
              <input
                type="text"
                value={opt.text}
                onChange={(e) => onUpdateOption(optIdx, e.target.value, opt.is_correct)}
                placeholder={`Option ${optIdx + 1}`}
                className="input"
                style={{ flex: 1 }}
              />
              {question.options!.length > 2 && (
                <button onClick={() => onRemoveOption(optIdx)} className="btn btn-danger-ghost btn-sm">
                  ✕
                </button>
              )}
            </div>
          ))}
          {question.question_type === 'multiple_choice' && (
            <button onClick={onAddOption} className="btn btn-ghost btn-sm">
              + Add Option
            </button>
          )}
        </div>
      )}

      {/* Short Answer / Essay */}
      {(question.question_type === 'short_answer' || question.question_type === 'essay') && (
        <div>
          <label className="field-label">Sample Answer (for grading reference)</label>
          <textarea
            value={question.sample_answer || ''}
            onChange={(e) => onUpdate({ sample_answer: e.target.value })}
            placeholder="Provide a sample correct answer..."
            className="textarea"
            rows={2}
            style={{ marginBottom: 10 }}
          />
          <label className="field-label">Grading Rubric (optional)</label>
          <textarea
            value={question.grading_rubric || ''}
            onChange={(e) => onUpdate({ grading_rubric: e.target.value })}
            placeholder="Key points to look for when grading..."
            className="textarea"
            rows={2}
          />
        </div>
      )}

      {/* Explanation */}
      <div style={{ marginTop: 10 }}>
        <label className="field-label">Explanation (shown after submission, optional)</label>
        <textarea
          value={question.explanation || ''}
          onChange={(e) => onUpdate({ explanation: e.target.value })}
          placeholder="Explain the correct answer..."
          className="textarea"
          rows={2}
        />
      </div>
    </motion.div>
  )
}
