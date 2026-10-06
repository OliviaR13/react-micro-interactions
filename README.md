# React Micro Interactions

> 47 polished React + Framer Motion micro-interaction components

[English](#english) · [中文](#中文)

![Components](https://img.shields.io/badge/components-47-blue)
![React](https://img.shields.io/badge/React-18+-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-11+-0055FF)

---

<a id="english"></a>

## Overview

A collection of **47 ready-to-use React micro-interaction components**. Each component includes:

- Complete `.tsx` source code (with detailed design comments)
- `meta.json` — install dependencies, usage examples, design notes
- Original author's implementation notes to help understand animation logic

Inspired by components from [bencho.dev](https://bencho.dev).

## Tech Stack

| Tech | Purpose |
|------|---------|
| React 18+ | Component framework |
| TypeScript | Type safety |
| Framer Motion | Animation engine |
| Lucide React | Icon library |
| liquid-gooey | Liquid distortion effects |

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/OliviaR13/react-micro-interactions.git

# 2. Browse components
cd react-micro-interactions/assets/components/

# 3. Check meta.json for install & usage
cat slide-confirm/meta.json

# 4. Copy the .tsx file into your project, install deps, done
```

## Component Categories

### 🎯 Interactions (11)

| Component | Description |
|-----------|-------------|
| `like` | Animated like button |
| `magnet-select` | Magnetic selection picker |
| `checklist` | Animated todo checklist |
| `drag-ball` | Draggable ball |
| `dock` | Magnifying hover dock |
| `pull` | Mobile pull-to-refresh |
| `slide-confirm` | Slide-to-confirm slider |
| `confirm` | Inline expanding confirm button |
| `stepper` | Drag-to-adjust stepper |
| `liq-arrange` | Draggable reorderable list |
| `liq-toggle` | Liquid morph toggle switch |

### 🧭 Navigation & Menus (5)

| Component | Description |
|-----------|-------------|
| `radial` | Circular radial expand menu |
| `liq-create` | Liquid create menu |
| `command` | Command palette / search bar |
| `toolbar` | Design-tool style toolbar |
| `icon-bar` | Bottom icon navigation bar |

### ✏️ Input & Forms (6)

| Component | Description |
|-----------|-------------|
| `label-input` | Floating label input |
| `seek` | Animated search box |
| `one-time-code` | 6-digit OTP input |
| `upload-dropzone` | File drag-and-drop upload zone |
| `signature` | Handwriting signature pad |
| `palette` | Color picker |

### 📊 Dashboards & Data (10)

| Component | Description |
|-----------|-------------|
| `asset-swap` | Crypto asset swap exchanger |
| `sound` | Now playing card |
| `heat-word` | Text heat map |
| `humidity` | Circular humidity gauge |
| `sleep` | Sleep quality ring chart |
| `progress` | Tick-style progress bar |
| `time-scrubber` | Video timeline scrubber |
| `step-player` | Step-by-step player |
| `slosh` | Liquid slosh slider |
| `carousel` | Card carousel |

### 🃏 Cards & Layouts (6)

| Component | Description |
|-----------|-------------|
| `tilt` | 3D tilt-follow card |
| `image-accordion` | Image expand accordion |
| `image-compare` | Before/after comparison slider |
| `glass-bubble` | Frosted glass bubble |
| `dynamic-island` | iOS Dynamic Island style |
| `aspect` | Aspect ratio selector |

### 🔔 Feedback & States (9)

| Component | Description |
|-----------|-------------|
| `toasts` | Toast notifications |
| `generate` | AI generate button animation |
| `particles` | Particle burst effect |
| `voice-note` | Voice recording button UI |
| `todo-tower` | Stacked todo cards |
| `action-node` | Workflow node card |
| `picker` | Avatar picker |
| `roster` | Multi-select list |
| `eye-tracker` | Eye cursor follower |

## Project Structure

```
react-micro-interactions/
├── SKILL.md                    # Skill entry doc
├── README.md                   # This file
└── assets/
    └── components/              # Component library
        ├── like/
        │   ├── like.tsx        # Full component source
        │   └── meta.json       # Install + usage + design notes
        ├── slide-confirm/
        │   ├── slide-confirm.tsx
        │   └── meta.json
        └── ... (47 components total)
```

## Usage Example

Using `slide-confirm`:

```bash
# Install dependencies
npm install framer-motion lucide-react
```

```tsx
// Copy slide-confirm.tsx into your project
import { SlideConfirm } from "./SlideConfirm";

<SlideConfirm
  corner={28}
  speed={50}
  width={280}
/>
```

## Credits

Component designs and source code inspired by [bencho.dev](https://bencho.dev), created by Lorenzo Cabra.
This repository is a curated collection for learning and reference.

## License

Component source code is licensed under **MIT License**, copyright by Lorenzo Cabra.
See [LICENSE](LICENSE) for details.

> Sample images (crypto icons, flags) included in some components have their own original copyrights. Replace them with your own assets for commercial use.

---

<a id="中文"></a>

## 简介

一个收集了 **47 个可直接使用的 React 微交互组件源码**的组件库。每个组件都附带：

- 完整的 `.tsx` 源码（含详细设计注释）
- `meta.json` — 安装依赖、引入用法、设计思路说明
- 原作者的实现思路注释，帮助理解动画原理

灵感与组件设计来自 [bencho.dev](https://bencho.dev)。

## 技术栈

| 技术 | 用途 |
|------|------|
| React 18+ | 组件框架 |
| TypeScript | 类型安全 |
| Framer Motion | 动画引擎 |
| Lucide React | 图标库 |
| liquid-gooey | 液体形变效果 |

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/OliviaR13/react-micro-interactions.git

# 2. 找到你需要的组件
cd react-micro-interactions/assets/components/

# 3. 读取 meta.json 查看安装和用法
cat slide-confirm/meta.json

# 4. 复制 .tsx 文件到你的项目，安装依赖即可使用
```

## 组件分类

### 🎯 交互动作 (11)

| 组件 | 描述 |
|------|------|
| `like` | 点赞按钮动画 |
| `magnet-select` | 磁吸吸附选择器 |
| `checklist` | 带动画的待办清单 |
| `drag-ball` | 可拖拽小球 |
| `dock` | 悬停放大 Dock 栏 |
| `pull` | 移动端下拉刷新 |
| `slide-confirm` | 滑动确认滑块 |
| `confirm` | 原地展开确认按钮 |
| `stepper` | 拖拽数值步进器 |
| `liq-arrange` | 可拖拽排序列表 |
| `liq-toggle` | 液体效果开关 |

### 🧭 导航菜单 (5)

| 组件 | 描述 |
|------|------|
| `radial` | 圆形径向展开菜单 |
| `liq-create` | 液体效果创建菜单 |
| `command` | 命令面板 / 搜索栏 |
| `toolbar` | 设计工具风格工具栏 |
| `icon-bar` | 底部图标导航栏 |

### ✏️ 输入表单 (6)

| 组件 | 描述 |
|------|------|
| `label-input` | 浮动标签输入框 |
| `seek` | 带动画搜索框 |
| `one-time-code` | 六位验证码输入 |
| `upload-dropzone` | 文件拖拽上传区 |
| `signature` | 手写签名画板 |
| `palette` | 颜色选择器 |

### 📊 数据仪表盘 (10)

| 组件 | 描述 |
|------|------|
| `asset-swap` | 加密货币兑换器 |
| `sound` | 正在播放卡片 |
| `heat-word` | 文字热力图 |
| `humidity` | 圆形湿度仪表 |
| `sleep` | 睡眠质量环形图 |
| `progress` | 刻度式进度条 |
| `time-scrubber` | 视频时间轴拖拽 |
| `step-player` | 分步播放器 |
| `slosh` | 液体晃动滑块 |
| `carousel` | 卡片轮播 |

### 🃏 卡片布局 (6)

| 组件 | 描述 |
|------|------|
| `tilt` | 3D 倾斜跟随卡片 |
| `image-accordion` | 图片展开手风琴 |
| `image-compare` | 前后对比滑块 |
| `glass-bubble` | 毛玻璃气泡 |
| `dynamic-island` | iOS 灵动岛风格 |
| `aspect` | 宽高比选择器 |

### 🔔 状态反馈 (9)

| 组件 | 描述 |
|------|------|
| `toasts` | 通知弹窗 |
| `generate` | AI 生成按钮动画 |
| `particles` | 粒子爆发效果 |
| `voice-note` | 录音按钮界面 |
| `todo-tower` | 堆叠待办卡片 |
| `action-node` | 流程节点卡片 |
| `picker` | 头像选择器 |
| `roster` | 可多选列表 |
| `eye-tracker` | 眼球跟随鼠标 |

## 目录结构

```
react-micro-interactions/
├── SKILL.md                    # Skill 入口文档
├── README.md                   # 本文件
└── assets/
    └── components/              # 组件源码库
        ├── like/
        │   ├── like.tsx        # 完整组件源码
        │   └── meta.json       # 安装依赖 + 用法示例 + 设计说明
        ├── slide-confirm/
        │   ├── slide-confirm.tsx
        │   └── meta.json
        └── ... (共 47 个组件)
```

## 在项目中使用

以 `slide-confirm` 为例：

```bash
# 安装依赖
npm install framer-motion lucide-react
```

```tsx
// 复制 slide-confirm.tsx 到你的项目
import { SlideConfirm } from "./SlideConfirm";

<SlideConfirm
  corner={28}
  speed={50}
  width={280}
/>
```

## 致谢

组件设计与源码灵感来自 [bencho.dev](https://bencho.dev)，由 Lorenzo Cabra 创作。
本仓库为方便学习和查阅而整理归档。

## License

组件源码以 **MIT License** 发布，版权归 Lorenzo Cabra 所有。
详见 [LICENSE](LICENSE) 文件。

> 组件中的示例图片（如加密货币图标、国旗）各有其原始版权，商用时请替换为自有素材。
