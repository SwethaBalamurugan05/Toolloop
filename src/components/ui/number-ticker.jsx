import { animate, useInView, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef } from 'react'

// Source: Magic UI Number Ticker, Dillion Verma — https://21st.dev/magicui/number-ticker/default
// 21st.dev registry component; MIT License. Adapted only from TypeScript to JSX for this project.
export function NumberTicker({ value = 0, decimalPlaces = 0, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { damping: 50, stiffness: 100 })
  useEffect(() => { if (inView) animate(motionValue, value, { duration: 0.9 }) }, [inView, motionValue, value])
  useEffect(() => springValue.on('change', (latest) => { if (ref.current) ref.current.textContent = Intl.NumberFormat('en-US', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(latest) }), [springValue, decimalPlaces])
  return <span ref={ref} className={className}>0</span>
}