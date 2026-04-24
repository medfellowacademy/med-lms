import { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'

export async function parseJson<T>(req: Request, schema: ZodSchema<T>):
  Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return { data: null, error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }
  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Validation failed', issues: result.error.issues },
        { status: 400 }
      ),
    }
  }
  return { data: result.data, error: null }
}
