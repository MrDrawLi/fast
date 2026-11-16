# 互动故事播放器（Vite + Vue3）

由 **图片 / 视频 / 热区** 构成的互动故事引擎，故事线完全由 JSON 配置驱动。

## 运行

```bash
npm run dev      # 开发（热更新）
npm run build    # 生产打包
npm run preview  # 预览打包产物
```

## 目录结构

```
src/
├── engine/
│   ├── StoryPlayer.vue   # 播放器组件：背景渲染、热区层、调试模式
│   └── useStory.js       # 引擎逻辑：场景流转、背景继承、事件分发
├── story/
│   ├── story.json        # ★ 故事线配置（改这里）
│   └── handlers.js       # ★ 自定义热区回调（改这里）
└── App.vue
public/assets/            # 把你的图片、视频放这里
```

## story.json 配置说明

```jsonc
{
  "start": "scene-1",          // 起始场景 id
  "scenes": [
    {
      "id": "scene-1",

      // 背景二选一；省略 bg 表示继承上一幕背景
      // （视频会停在上一幕播放结束的最后一帧）
      "bg": { "type": "image", "src": "/assets/xxx.jpg" },
      "bg": { "type": "video", "src": "/assets/xxx.mp4", "muted": true, "loop": false },

      // 热区：rect = [左上x, 左上y, 右下x, 右下y]
      "hotspots": [
        {
          "name": "热点名称",
          "rect": [10, 20, 40, 80],          // 默认为全屏百分比(0~100)
          "unit": "px",                      // 可选：改为像素坐标
          "events": [                        // 点击后依次触发的事件
            { "type": "goto",   "target": "scene-2" },
            { "type": "custom", "name": "openDrawer", "args": { "key": "value" } }
          ]
        }
      ],

      // 悬停图层：鼠标移入 trigger 区域时显示一组图片
      "overlays": [
        {
          "name": "窗边暗门",
          "trigger": { "rect": [34, 32, 53, 55] },     // 触发区域（坐标系同热区，支持 unit）
          "items": [
            // 无 events = 纯展示图片（如横条提示图），不挡下层点击
            { "image": "/assets/hover-bar.svg", "rect": [20, 8, 84, 19] },
            // 带 events = 可点击图片，点击触发事件（如 svg 图片点击进入下一幕）
            { "image": "/assets/hover-door.svg", "rect": [58, 24, 70, 44],
              "events": [{ "type": "goto", "target": "scene-2" }] }
          ]
        }
      ]
    }
  ]
}
```

`items` 可选字段：`"unit": "px"` 像素坐标、`"fit": "contain" | "cover" | "fill"`（默认 fill，
图片按矩形拉伸，contain 可保持原始比例）。

### 事件类型

| type       | 说明 | 附加字段 |
| ---------- | ---- | -------- |
| `goto`     | 跳转到指定场景 | `target`: 场景 id |
| `back`     | 返回上一幕 | — |
| `restart`  | 清空历史、回到起始场景 | — |
| `log`      | 控制台打印 | `message` |
| `custom`   | 调用 `handlers.js` 中注册的函数 | `name`, `args` |

### 自定义回调（handlers.js）

```js
export const handlers = {
  openDrawer({ args, engine }) {
    engine.notify('抽屉打开了！')   // 屏幕弹提示
    // engine.goto('scene-3')       // 跳场景
    // engine.back() / engine.restart()
    // engine.videoEl               // 当前 <video> 元素
    // engine.sceneId / engine.scene
  },
}
```

## 坐标系与调试模式

- **任何时候点击屏幕**，控制台都会输出该点坐标：

```
[坐标] 百分比: (52.31, 44.27)  像素: (1004, 478)  → rect: [52.31, 44.27, ?, ?]
```

把打印出的百分比坐标直接填进 `rect` 的左上角，再点击热区右下角取一次坐标即可完成配置。
（像素坐标需配合热区的 `"unit": "px"` 使用。）

- 访问 **`http://localhost:5173/?debug=1`** 进入调试模式，额外提供可视化辅助：

  - 所有热区显示为青色虚线框并标注名称
  - 悬停触发区显示为绿色虚线框并标注名称
  - 右上角 HUD 显示当前场景、生效背景、激活的悬停图层
  - 点击处显示坐标标记气泡

控制台还可手动驱动引擎：`__story.goto('scene-3')`、`__story.back()`、`__story.restart()`。

## 素材

图片放 `public/assets/`（jpg/png/webp/svg 均可），视频放同目录（mp4/webm）。
浏览器自动预加载所有图片；视频默认静音自动播放（浏览器策略要求），需要声音的场景建议先让用户点击一次（任意热区点击即解除限制）。
