import { ref, watch, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import useRaf from './useRaf'
import type { RafOptions } from './useRaf'

interface AnchorStruct<T> {
  key: T
  [k: string]: any
}

interface AffixAnchorOptions extends RafOptions {
  offset?: number
  scrollToOffset?: number
}

interface AffixAnchorOptionsWithActive<T> extends AffixAnchorOptions {
  active: T
}

interface AffixAnchorOptionsReturnType<T, P = T> {
  activeAnchor: Ref<P>
  mainContainer: Ref<HTMLElement | undefined>
  anchorContainer: Ref<HTMLElement | undefined>
  setAnchorContent: (key: T, $el: HTMLElement) => void
  onFocusAnchor: (key: P) => void
}

function useAffixAnchor<T extends string, P = any>(anchors: Ref<AnchorStruct<T>[] | T[]>, options?: AffixAnchorOptions): AffixAnchorOptionsReturnType<T, P | undefined>
function useAffixAnchor<T extends string>(anchors: Ref<AnchorStruct<T>[] | T[]>, options?: AffixAnchorOptionsWithActive<T>): AffixAnchorOptionsReturnType<T>
function useAffixAnchor<T extends string>(anchors: Ref<AnchorStruct<T>[] | T[]>, options?: AffixAnchorOptionsWithActive<number>): AffixAnchorOptionsReturnType<T, number>
function useAffixAnchor<T extends string>(anchors: Ref<AnchorStruct<T>[] | T[]>, options: any = {}) {
  const mainContainer = ref<HTMLElement>()
  const scrollContainer = ref<HTMLElement>()
  const anchorContainer = ref<HTMLElement>()
  const activeAnchor = ref(options.active)

  const anchorContentMap = new Map<T, HTMLElement>()

  const {
    offset = 100,
    scrollToOffset = 10,
    points,
    duration,
  } = options

  const { startRaf } = useRaf({
    points,
    duration,
  })

  const getAnchorKey = (anchor: AnchorStruct<T> | T) => {
    if (typeof anchor === 'string') {
      return anchor
    }

    return anchor.key
  }

  const getActiveValue = (index: number) => {
    if (typeof activeAnchor.value === 'string') {
      return getAnchorKey(anchors.value[index])
    }

    return index
  }

  const getScrollContainer = (currentDom?: HTMLElement) => {
    let dom = currentDom || null

    while (dom) {
      const { overflowY } = window.getComputedStyle(dom)

      if (overflowY === 'auto' || overflowY === 'scroll') {
        return dom
      }

      dom = dom.parentElement
    }

    return undefined
  }

  const setAnchorContent = (key: T, $el: HTMLElement) => {
    anchorContentMap.set(key, $el)
  }

  const getActiveAnchor = () => {
    const len = anchors.value.length

    if (len) {
      let baseline = offset
      let index = len - 1

      if (anchorContainer.value) {
        baseline += anchorContainer.value.getBoundingClientRect().bottom
      }

      while (index && len) {
        const anchorContent = anchorContentMap.get(getAnchorKey(anchors.value[index]))

        if (anchorContent) {
          if (anchorContent.getBoundingClientRect().top < baseline) {
            return getActiveValue(index)
          }
        }

        index -= 1
      }
    }

    return getActiveValue(0)
  }

  const onFocusAnchor = (key: any) => {
    const anchorContent = anchorContentMap.get(typeof key === 'string' ? (key as T) : getAnchorKey(anchors.value[key as number]))

    if (anchorContent) {
      let scrollTop = anchorContent.offsetTop - offset + scrollToOffset

      if (scrollContainer.value) {
        scrollTop -= scrollContainer.value.getBoundingClientRect().top
      }

      if (anchorContainer.value) {
        scrollTop -= anchorContainer.value.getBoundingClientRect().height
      }

      if (scrollContainer.value) {
        const baseScrollTop = scrollContainer.value.scrollTop
        const distance = scrollTop - baseScrollTop

        startRaf(rate => {
          scrollContainer.value!.scrollTop = baseScrollTop + (distance * rate)
        })

        return
      }

      const baseScrollTop = window.screenY
      const distance = scrollTop - baseScrollTop

      startRaf(rate => {
        window.scrollTo(0, baseScrollTop + (distance * rate))
      })
    }
  }

  const onScroll = () => {
    activeAnchor.value = getActiveAnchor()
  }

  const removeListener = (dom?: HTMLElement) => {
    if (dom) {
      dom.removeEventListener('scroll', onScroll)

      return
    }

    window.removeEventListener('scroll', onScroll)
  }

  watch(mainContainer, (cur, prev) => {
    removeListener(prev)

    scrollContainer.value = getScrollContainer(mainContainer.value)

    if (scrollContainer.value) {
      scrollContainer.value.addEventListener('scroll', onScroll)

      return
    }

    window.addEventListener('scroll', onScroll)
  }, { immediate: true })

  onBeforeUnmount(() => {
    removeListener(scrollContainer.value)
  })

  return {
    activeAnchor,
    mainContainer,
    anchorContainer,
    setAnchorContent,
    onFocusAnchor,
  }
}

export default useAffixAnchor
