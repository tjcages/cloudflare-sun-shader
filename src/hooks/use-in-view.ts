import { useEffect, useRef, useState } from "react"

interface UseInViewOptions {
  threshold?: number
  rootMargin?: string
  root?: Element | null
  initialInView?: boolean
  loop?: boolean
}

export function useInView<T extends Element = HTMLDivElement>(
  options: UseInViewOptions = {},
) {
  const {
    threshold = 0.1,
    rootMargin = "50px",
    root = null,
    initialInView = false,
    loop = false,
  } = options

  const [isInView, setIsInView] = useState(initialInView)
  const ref = useRef<T>(null)
  const isInViewRef = useRef(initialInView)
  const hasBeenInViewRef = useRef(initialInView)
  const loopRef = useRef(loop)

  useEffect(() => {
    isInViewRef.current = isInView
  }, [isInView])

  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          hasBeenInViewRef.current = true
          isInViewRef.current = true
        } else if (loopRef.current || !hasBeenInViewRef.current) {
          setIsInView(false)
          isInViewRef.current = false
        }
      },
      { threshold, rootMargin, root },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, root])

  return { ref, isInView }
}
