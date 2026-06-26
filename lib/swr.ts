'use client'

import useSWR, { SWRConfiguration } from 'swr'

export const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const info = await res.json().catch(() => ({}))
    const err = new Error(info.error || 'Request failed') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json()
}

export function useApi<T = any>(key: string | null, options?: SWRConfiguration) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    ...options,
  })
}
