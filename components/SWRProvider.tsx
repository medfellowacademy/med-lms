'use client'

import { SWRConfig } from 'swr'
import { fetcher } from '@/lib/swr'

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: 30_000,
      }}
    >
      {children}
    </SWRConfig>
  )
}
