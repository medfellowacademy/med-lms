'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

interface Props {
  value: number
  duration?: number
  className?: string
  style?: React.CSSProperties
}

export default function CountUp({ value, duration = 1.2, className, style }: Props) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const obj = { n: 0 }
    const el = ref.current
    const ctx = gsap.to(obj, {
      n: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = Math.round(obj.n).toString()
      },
    })
    return () => {
      ctx.kill()
    }
  }, [value, duration])

  return <span ref={ref} className={className} style={style}>0</span>
}
