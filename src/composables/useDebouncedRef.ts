import { customRef, onScopeDispose, ref, watch, type Ref } from 'vue'

/**
 * A read-only mirror of `source` that updates only once it stops changing.
 *
 * Used for search boxes whose value is a query parameter: the input stays
 * instant because it is bound to `source`, while the request is issued from this
 * ref, so typing a phone number costs one round trip rather than one per
 * keystroke.
 */
export function useDebouncedRef<T>(source: Ref<T>, delay = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = value
    }, delay)
  })

  // Leaving a timer to fire after the component is gone would set a ref nothing
  // is watching, and in tests it keeps the process alive.
  onScopeDispose(() => clearTimeout(timer))

  return debounced
}

/**
 * A writable ref whose reads are immediate but whose writes settle after `delay`.
 *
 * Kept for the case where one ref has to serve both the input and the query.
 */
export function useDebouncedWritableRef<T>(initial: T, delay = 300): Ref<T> {
  let value = initial
  let timer: ReturnType<typeof setTimeout> | undefined

  const result = customRef<T>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(next) {
      clearTimeout(timer)
      timer = setTimeout(() => {
        value = next
        trigger()
      }, delay)
    },
  }))

  onScopeDispose(() => clearTimeout(timer))

  return result
}
