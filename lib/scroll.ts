const DEFAULT_OFFSET_PX = 112

export function scrollToElementWithOffset(
  element: Element,
  options?: {
    offsetPx?: number
    behavior?: ScrollBehavior
  }
) {
  if (typeof window === "undefined") return
  const offsetPx = options?.offsetPx ?? DEFAULT_OFFSET_PX
  const behavior = options?.behavior ?? "smooth"
  const top = element.getBoundingClientRect().top + window.scrollY - offsetPx
  window.scrollTo({ top: Math.max(top, 0), behavior })
}

export function scrollToSelectorWithOffset(
  selector: string,
  options?: {
    offsetPx?: number
    behavior?: ScrollBehavior
  }
) {
  if (typeof document === "undefined") return false
  const target = document.querySelector(selector)
  if (!target) return false
  scrollToElementWithOffset(target, options)
  return true
}
