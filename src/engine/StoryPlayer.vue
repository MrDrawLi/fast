<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useStory } from './useStory'
import storyData from '../story/story.json'

const props = defineProps({
  /** 调试模式：显示热区框、触发区框、点击处坐标标记；也可用 URL 参数 ?debug=1 开启 */
  debug: { type: Boolean, default: false },
})

const stage = ref(null)
const videoEl = ref(null)

const {
  scene, sceneId, effectiveBg, fire, goto, back, restart, notify, toast,
} = useStory({ getVideoEl: () => videoEl.value })

const debug = computed(() => props.debug || new URLSearchParams(location.search).has('debug'))

/* ---------------- 背景渲染 ---------------- */
const bgKey = computed(() => (effectiveBg.value ? `${effectiveBg.value.type}:${effectiveBg.value.src}` : 'none'))
const isVideoBg = computed(() => effectiveBg.value?.type === 'video')
const isImageBg = computed(() => effectiveBg.value?.type === 'image')

function onVideoError(e) {
  console.error('[story] 视频加载失败:', effectiveBg.value?.src, e)
  notify(`视频加载失败: ${effectiveBg.value?.src}`)
}
function onImageError(e) {
  console.error('[story] 图片加载失败:', effectiveBg.value?.src, e)
  notify(`图片加载失败: ${effectiveBg.value?.src}`)
}

/* ---------------- 通用矩形 ---------------- */
/**
 * rect: [x1, y1, x2, y2] —— 左上角 (x1,y1)、右下角 (x2,y2)
 * 默认单位是全屏百分比(0~100)；配置 "unit": "px" 时为像素坐标
 * 热区、悬停触发区、悬停图片均复用此规则
 */
function rectStyle(cfg = {}) {
  const [x1, y1, x2, y2] = cfg.rect ?? [0, 0, 0, 0]
  const px = cfg.unit === 'px'
  return {
    left: px ? `${x1}px` : `${x1}%`,
    top: px ? `${y1}px` : `${y1}%`,
    width: px ? `${x2 - x1}px` : `${x2 - x1}%`,
    height: px ? `${y2 - y1}px` : `${y2 - y1}%`,
  }
}

/* ---------------- 点击热区 ---------------- */
function onHotspotClick(h) {
  console.log(`[story] 触发热区「${h.name}」@ ${sceneId.value}`)
  fire(h.events)
}

/* ---------------- 悬停图层 ----------------
 * scene.overlays: [{ name, trigger:{rect,unit}, items:[{image, rect, unit?, fit?, events?}] }]
 * 鼠标移入 trigger 区域 → 显示 items（横条图片、带事件的图片二等）
 * 带 events 的 item 点击触发事件；不带 events 的纯展示、不挡下层点击
 */
const activeOverlay = ref(null)

function onStageMouseMove(e) {
  const r = stage.value.getBoundingClientRect()
  const px = { x: e.clientX - r.left, y: e.clientY - r.top }
  let hit = null
  for (const ov of scene.value?.overlays ?? []) {
    const t = ov.trigger
    if (!t?.rect) continue
    const x = t.unit === 'px' ? px.x : (px.x / r.width) * 100
    const y = t.unit === 'px' ? px.y : (px.y / r.height) * 100
    const [x1, y1, x2, y2] = t.rect
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) { hit = ov; break }
  }
  activeOverlay.value = hit
}

watch(sceneId, () => { activeOverlay.value = null })

function onOverlayItemClick(item) {
  console.log(`[story] 触发悬停图片「${item.image}」@ ${sceneId.value}`)
  fire(item.events)
}

/* ---------------- 调试：点击输出全屏坐标 ---------------- */
const debugPoint = ref(null) // { px: {x,y}, pct: {x,y} }

function onStageClickCapture(e) {
  const r = stage.value.getBoundingClientRect()
  const px = { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) }
  const pct = {
    x: +((px.x / r.width) * 100).toFixed(2),
    y: +((px.y / r.height) * 100).toFixed(2),
  }
  // 始终在控制台输出坐标，方便配置热区；百分比可直接填进 story.json 的 rect，像素需配合 "unit":"px"
  console.log(
    `[坐标] 百分比: (${pct.x}, ${pct.y})  像素: (${px.x}, ${px.y})`,
    `→ rect: [${pct.x}, ${pct.y}, ?, ?]`,
  )
  if (debug.value) debugPoint.value = { px, pct }
}

/* ---------------- 预加载图片素材 ---------------- */
function preload(src) {
  const img = new Image()
  img.src = src
}

onMounted(() => {
  for (const s of storyData.scenes) {
    if (s.bg?.type === 'image') preload(s.bg.src)
    for (const ov of s.overlays ?? []) {
      for (const it of ov.items ?? []) if (it.image) preload(it.image)
    }
  }
  // 调试模式下把引擎挂到 window，方便在控制台手动测试：__story.goto('scene-3')
  if (debug.value) window.__story = { goto, back, restart, sceneId }
})

onBeforeUnmount(() => { delete window.__story })
</script>

<template>
  <div
    ref="stage"
    class="stage"
    @click.capture="onStageClickCapture"
    @mousemove="onStageMouseMove"
    @mouseleave="activeOverlay = null"
  >
    <!-- 背景层：图片 / 视频，淡入切换 -->
    <Transition name="bg-fade">
      <video
        v-if="isVideoBg"
        :key="bgKey"
        ref="videoEl"
        class="bg-media"
        :src="effectiveBg.src"
        :muted="effectiveBg.muted !== false"
        :loop="!!effectiveBg.loop"
        autoplay
        playsinline
        preload="auto"
        @error="onVideoError"
      />
      <img
        v-else-if="isImageBg"
        :key="bgKey"
        class="bg-media"
        :src="effectiveBg.src"
        alt=""
        @error="onImageError"
      />
    </Transition>

    <!-- 热区层 -->
    <div
      v-for="h in scene?.hotspots ?? []"
      :key="h.name"
      class="hotspot"
      :class="{ 'hotspot-debug': debug }"
      :style="rectStyle(h)"
      :title="h.name"
      @click="onHotspotClick(h)"
    >
      <span v-if="debug" class="hotspot-label">{{ h.name }}</span>
    </div>

    <!-- 悬停图层：移入触发区后显示的图片（在热区之上） -->
    <template v-if="activeOverlay">
      <img
        v-for="(item, j) in activeOverlay.items ?? []"
        :key="j"
        class="overlay-item"
        :class="{ 'overlay-item-clickable': item.events?.length }"
        :src="item.image"
        :style="{ ...rectStyle(item), objectFit: item.fit ?? 'fill' }"
        alt=""
        @click.stop="onOverlayItemClick(item)"
      />
    </template>

    <!-- 调试：悬停触发区轮廓（不挡鼠标） -->
    <template v-if="debug">
      <div
        v-for="(ov, i) in scene?.overlays ?? []"
        :key="'ovt' + i"
        class="overlay-trigger-debug"
        :style="rectStyle(ov.trigger)"
      >
        <span class="overlay-trigger-label">{{ ov.name }}（悬停触发）</span>
      </div>
    </template>

    <!-- 调试 HUD -->
    <div v-if="debug" class="hud">
      <div>场景: {{ sceneId }}</div>
      <div>背景: {{ effectiveBg ? `${effectiveBg.type} ${effectiveBg.src}` : '无（继承上一幕）' }}</div>
      <div v-if="activeOverlay">悬停图层: {{ activeOverlay.name }}</div>
      <div>点击屏幕可取坐标（百分比 / 像素），控制台同步输出</div>
    </div>

    <!-- 调试坐标标记 -->
    <div
      v-if="debugPoint"
      class="debug-point"
      :style="{ left: debugPoint.px.x + 'px', top: debugPoint.px.y + 'px' }"
    >
      <span class="debug-point-label">
        ({{ debugPoint.pct.x }}%, {{ debugPoint.pct.y }}%) · ({{ debugPoint.px.x }}, {{ debugPoint.px.y }})px
      </span>
    </div>

    <!-- 提示气泡 -->
    <Transition name="toast-fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.stage {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #000;
  user-select: none;
}

/* 背景 */
.bg-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.bg-fade-enter-active { transition: opacity 0.35s ease; }
.bg-fade-enter-from { opacity: 0; }

/* 热区 */
.hotspot {
  position: absolute;
  cursor: pointer;
}
.hotspot-debug {
  border: 2px dashed #00e5ff;
  background: rgba(0, 229, 255, 0.12);
}
.hotspot-label {
  position: absolute;
  left: 4px;
  top: 4px;
  font-size: 13px;
  line-height: 1.4;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #00e5ff;
  white-space: nowrap;
}

/* 悬停图层 */
.overlay-item {
  position: absolute;
  animation: ov-in 0.25s ease both;
}
.overlay-item-clickable { cursor: pointer; }
@keyframes ov-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

/* 调试：悬停触发区 */
.overlay-trigger-debug {
  position: absolute;
  border: 2px dashed #7cff9e;
  background: rgba(124, 255, 158, 0.1);
  pointer-events: none;
}
.overlay-trigger-label {
  position: absolute;
  left: 4px;
  top: 4px;
  font-size: 13px;
  line-height: 1.4;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #7cff9e;
  white-space: nowrap;
}

/* 调试 HUD */
.hud {
  position: absolute;
  right: 12px;
  top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #9feaf9;
  font-size: 13px;
  line-height: 1.7;
  pointer-events: none;
  max-width: 40vw;
}

/* 调试坐标标记 */
.debug-point {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: #ff5252;
  box-shadow: 0 0 0 3px rgba(255, 82, 82, 0.35);
  pointer-events: none;
}
.debug-point-label {
  position: absolute;
  left: 14px;
  top: -8px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.75);
  color: #ffd7d7;
  font-size: 13px;
  white-space: nowrap;
}

/* 提示气泡 */
.toast {
  position: absolute;
  left: 50%;
  bottom: 6%;
  transform: translateX(-50%);
  padding: 10px 22px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 15px;
  pointer-events: none;
}
.toast-fade-enter-active,
.toast-fade-leave-active { transition: opacity 0.25s; }
.toast-fade-enter-from,
.toast-fade-leave-to { opacity: 0; }
</style>
