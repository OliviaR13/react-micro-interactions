---
name: bencho-ui-components
description: "Bencho UI 交互式组件库 — 47 个精致的 React + Framer Motion 微交互组件源码集合。当需要在前端项目中添加高级 UI 交互效果（磁吸选择、滑动确认、液体开关、径向菜单、灵动岛、下拉刷新、拖拽排序列表等）时使用。适用于：(1) 查找或复制特定交互组件的完整源码，(2) 为 React 项目添加精致的微交互，(3) 参考组件实现思路和动画模式，(4) 搜索符合特定交互类型（hover/drag/slide/press）的组件。"
---

# Bencho UI Components

47 个来自 [bencho.dev](https://bencho.dev) 的交互式 React UI 组件完整源码集合。

## 技术栈

- **框架**: React + TypeScript (.tsx)
- **动画**: Framer Motion (大部分组件使用)
- **图标**: Lucide React
- **液体效果**: liquid-gooey (部分组件)
- **样式**: 组件内联 CSS / CSS-in-JS

## 快速开始

1. 从下方组件索引中找到需要的组件
2. 读取 `assets/components/<slug>/meta.json` 查看安装依赖和用法示例
3. 读取 `assets/components/<slug>/<slug>.tsx` 获取完整组件源码
4. 复制到项目中，按 `meta.json` 中的 install 命令安装依赖

## 组件索引

### 交互动作类 (Hover / Press / Drag / Slide)

| Slug | 名称 | 描述 |
|------|------|------|
| `like` | Like 点赞按钮 | 带动画的心形点赞按钮 |
| `magnet-select` | Magnetic select 磁吸选择 | 磁吸吸附的选择器 |
| `checklist` | Checklist 清单 | 带动画的待办清单 |
| `drag-ball` | Dragging ball 拖拽球 | 可拖拽的小球 |
| `dock` | Magnifying dock 悬浮坞 | 悬停放大的 Dock 栏 |
| `pull` | Pull to refresh 下拉刷新 | 移动端下拉刷新动画 |
| `slide-confirm` | Slide to confirm 滑动确认 | 滑动滑块完成确认 |
| `confirm` | Inline confirm 内联确认 | 原地展开的确认按钮 |
| `stepper` | Drag stepper 步进器 | 拖拽调整数值的步进器 |
| `liq-arrange` | Reorder list 拖拽排序列表 | 可拖拽排序的列表 |
| `liq-toggle` | Liquid toggle 液体开关 | 液体效果的切换开关 |

### 导航 / 菜单类

| Slug | 名称 | 描述 |
|------|------|------|
| `radial` | Radial menu 径向菜单 | 圆形径向展开菜单 |
| `liq-create` | Create menu 创建菜单 | 液体效果的创建菜单 |
| `command` | Command bar 命令栏 | 命令面板 / 搜索栏 |
| `toolbar` | Canvas toolbar 画布工具栏 | 设计工具风格的工具栏 |
| `icon-bar` | Icon bar 图标栏 | 底部图标导航栏 |

### 输入 / 表单类

| Slug | 名称 | 描述 |
|------|------|------|
| `label-input` | Label input 标签输入框 | 浮动标签输入框 |
| `seek` | Search 搜索框 | 带动画的搜索输入框 |
| `one-time-code` | One-time code 验证码 | 六位验证码输入框 |
| `upload-dropzone` | Upload dropzone 上传拖放区 | 文件拖拽上传区域 |
| `signature` | Signature pad 签名板 | 手写签名画板 |
| `palette` | Palette 调色板 | 颜色选择器 |

### 数据展示 / 仪表盘类

| Slug | 名称 | 描述 |
|------|------|------|
| `asset-swap` | Asset swap 资产交换器 | 加密货币兑换界面 |
| `sound` | Now playing 音乐播放器 | 正在播放卡片 |
| `heat-word` | Heat map 热力图 | 文字热力图 |
| `humidity` | Humidity 湿度指示器 | 圆形湿度仪表 |
| `sleep` | Sleep 睡眠指示器 | 睡眠质量环形图 |
| `progress` | Progress ticks 进度刻度 | 刻度式进度条 |
| `time-scrubber` | Time scrubber 时间拖拽条 | 视频时间轴拖拽 |
| `step-player` | Step player 步骤播放器 | 分步播放器 |
| `slosh` | Slosh slider 滑块 | 液体晃动效果滑块 |
| `carousel` | Carousel 轮播 | 卡片轮播组件 |

### 卡片 / 布局类

| Slug | 名称 | 描述 |
|------|------|------|
| `tilt` | Tilt card 倾斜卡片 | 3D 倾斜跟随卡片 |
| `image-accordion` | Image accordion 图片手风琴 | 图片展开手风琴 |
| `image-compare` | Image compare 图片对比 | 前后对比滑块 |
| `glass-bubble` | Glass bubble 玻璃气泡 | 毛玻璃气泡 |
| `dynamic-island` | Dynamic island 灵动岛 | iOS 灵动岛风格组件 |
| `aspect` | Aspect ratio 宽高比 | 宽高比选择器 |

### 状态反馈 / 工具类

| Slug | 名称 | 描述 |
|------|------|------|
| `toasts` | Notify 通知提示 | 通知弹窗 |
| `generate` | Generate 生成按钮 | AI 生成按钮动画 |
| `particles` | Particles 粒子效果 | 粒子爆发效果 |
| `voice-note` | Voice note 语音笔记 | 录音按钮界面 |
| `todo-tower` | Todo tower 待办塔 | 堆叠待办卡片 |
| `action-node` | Action node 动作节点 | 流程节点卡片 |
| `picker` | Assignees 人员选择器 | 头像选择器 |
| `roster` | Selection list 选择列表 | 可多选列表 |
| `eye-tracker` | Eye tracker 眼球追踪 | 鼠标眼球跟随 |

## 文件结构

```
assets/components/
├── <component-slug>/
│   ├── <component-slug>.tsx    # 完整组件源码
│   └── meta.json               # 元数据（名称、安装命令、用法示例、说明）
```

## 使用方式

### 复制组件到项目

1. 读取 `meta.json` 获取安装依赖和用法
2. 安装依赖：`npm install framer-motion lucide-react`（按组件需要）
3. 复制 `.tsx` 文件到项目组件目录
4. 按 `meta.json` 中的 usage 示例引入和使用

### 适配到非 React 项目

组件源码为 React/TypeScript 实现，若需在 Vue/HTML 等其他技术栈使用：
- 参考 `meta.json` 中的 `notes` 字段理解组件原理
- 提取核心动画逻辑（Framer Motion 对应 CSS transition / Web Animations API）
- 重新实现 DOM 结构和交互事件

### 组件元数据说明

每个组件的 `meta.json` 包含：
- `name`: 组件名称
- `install`: 安装命令（npm install ...）
- `usage`: 引入和使用示例代码
- `notes`: 组件设计思路和实现原理注释
- `url`: 原始组件页面链接
