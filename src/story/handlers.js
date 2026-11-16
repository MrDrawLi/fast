/**
 * 自定义热区回调注册表
 *
 * story.json 中热区事件 { "type": "custom", "name": "xxx" } 会在这里按 name 查找对应函数。
 * 函数入参：
 *   - args   { object }  事件里携带的 "args" 字段
 *   - engine { object }  引擎实例，可用方法：
 *       goto(id)      跳转到指定场景
 *       back()        返回上一幕
 *       restart()     重新开始故事
 *       notify(text)  在屏幕上弹一条提示
 *       sceneId       当前场景 id
 *       scene         当前场景配置对象
 *       videoEl       当前视频 <video> 元素（背景是视频时才有）
 */
export const handlers = {
  openDrawer({ engine }) {
    // 示例：这里可以换成任意逻辑 —— 请求接口、修改状态、跳转场景……
    engine.notify('抽屉打开了！（custom 回调 openDrawer 生效）')
    // 演示回调里也能跳场景：取消注释即可 3 秒后自动进入下一幕
    // setTimeout(() => engine.goto('scene-3'), 3000)
  },

  replayVideo({ engine }) {
    const video = engine.videoEl
    if (video) {
      video.currentTime = 0
      video.play()
      engine.notify('视频重新播放')
    } else {
      engine.notify('当前背景不是视频')
    }
  },
}
