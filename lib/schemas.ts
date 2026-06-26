import { z } from 'zod'

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
export type LoginInput = z.infer<typeof loginSchema>

// ---- Notes ----
export const createNoteSchema = z.object({
  content_id: z.string().uuid(),
  module_id: z.string().uuid(),
  course_id: z.string().uuid(),
  note_text: z.string().min(1).max(5000),
  timestamp_seconds: z.number().int().nonnegative().optional(),
})

// ---- Bookmarks ----
export const createBookmarkSchema = z.object({
  content_id: z.string().uuid(),
  module_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  timestamp_seconds: z.number().int().nonnegative().optional(),
})

// ---- Video progress ----
export const videoProgressSchema = z.object({
  content_id: z.string().uuid(),
  watch_time_seconds: z.number().nonnegative().optional(),
  total_duration_seconds: z.number().nonnegative().optional(),
  completed: z.boolean().optional(),
})

// ---- Activity ----
export const activitySchema = z.object({
  activity_type: z.string().min(1).max(64),
  content_id: z.string().uuid().optional(),
  module_id: z.string().uuid().optional(),
  sub_topic_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
})

// ---- Course ----
export const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
})
export type CreateCourseInput = z.infer<typeof createCourseSchema>

// ---- User creation (admin) ----
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().max(200).optional().default(''),
  role: z.enum(['student', 'admin']).default('student'),
})
