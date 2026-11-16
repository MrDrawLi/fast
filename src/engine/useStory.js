import { ref, shallowRef, computed, watch } from 'vue'
import storyData from '../story/story.json'
import { handlers } from '../story/handlers'

/**
 * 故事引擎：负责场景流转、背景继承、热区事件分发
 *
 * 背景继承规则：场景没有配置 bg 时，沿用上一幕的背景；
 * 视频背景播放到结尾后自然暂停，画面停留在最后一帧。
 */
export function useStory({ getVideoEl } = {}) {
  const scenes = storyData.scenes ?? []
  const sceneMap = new Map(scenes.map((s) => [s.id, s]))
  const startId = storyData.start ?? scenes[0]?.id

  const sceneId = ref(startId)
  const history = []
  const lastBg = shallowRef(null)
  const toast = ref('')
  let toastTimer = null

  const scene = computed(() => sceneMap.get(sceneId.value) ?? null)
  const effectiveBg = computed(() => scene.value?.bg ?? lastBg.value)

  // 场景声明了自己的 bg 时记为「最近一次背景」，供后续无 bg 的场景继承
  watch(effectiveBg, (bg) => { if (bg) lastBg.value = bg }, { immediate: true })

  function notify(text) {
    toast.value = text
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = ''), 2200)
  }

  function goto(id, { record = true } = {}) {
    if (!sceneMap.has(id)) {
      console.warn(`[story] 场景不存在: ${id}`)
      notify(`场景不存在: ${id}`)
      return
    }
    if (record && sceneId.value && sceneId.value !== id) history.push(sceneId.value)
    sceneId.value = id
  }

  function back() {
    const prev = history.pop()
    if (prev) goto(prev, { record: false })
    else notify('没有上一幕了')
  }

  function restart() {
    history.length = 0
    lastBg.value = null
    goto(startId, { record: false })
  }

  /** 引擎实例：传给自定义回调使用 */
  function makeEngine() {
    return {
      goto,
      back,
      restart,
      notify,
      get sceneId() { return sceneId.value },
      get scene() { return scene.value },
      get videoEl() { return getVideoEl?.() ?? null },
    }
  }

  /** 触发热区事件列表 */
  function fire(events = []) {
    for (const ev of events) dispatch(ev)
  }

  function dispatch(ev) {
    switch (ev?.type) {
      case 'goto': return goto(ev.target)
      case 'back': return back()
      case 'restart': return restart()
      case 'log': return console.log('[story]', ev.message ?? '')
      case 'custom': {
        const fn = handlers?.[ev.name]
        if (typeof fn === 'function') return fn({ args: ev.args ?? {}, engine: makeEngine() })
        console.warn(`[story] 未注册的自定义事件: ${ev.name}`)
        return notify(`未注册的自定义事件: ${ev.name}`)
      }
      default:
        console.warn(`[story] 未知事件类型: ${ev?.type}`)
    }
  }

  return { scenes, scene, sceneId, effectiveBg, fire, goto, back, restart, notify, toast }
}
