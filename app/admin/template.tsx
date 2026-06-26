'use client'

import PageTransition from '@/components/motion/PageTransition'

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
