'use client'

import PageTransition from '@/components/motion/PageTransition'

export default function StudentTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
