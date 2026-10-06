# Bencho UI Components

> 47 个精致的 React + Framer Motion 微交互组件完整源码，来自 [bencho.dev](https://bencho.dev)

![Components](https://img.shields.io/badge/components-47-blue)
![React](https://img.shields.io/badge/React-18+-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-11+-0055FF)

---

## 简介

这是一份从 [Bencho](https://bencho.dev) 完整采集的交互式 UI 组件库，包含 **47 个可直接使用的 React 组件源码**。每个组件都附带：

- 完整的 `.tsx` 源码（含详细设计注释）
- `meta.json` — 安装依赖、引入用法、设计思路说明
- 原作者的实现思路注释，帮助理解动画原理

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
git clone https://github.com/OliviaR13/bencho-ui-components.git

# 2. 找到你需要的组件
cd bencho-ui-components/assets/components/

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
bencho-ui-components/
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

组件设计与源码来自 [Bencho](https://bencho.dev)，由 [Lorenzo Cabra](https://bencho.dev) 创作。
本仓库仅为方便学习和查阅而整理归档。

## License

组件源码以 **MIT License** 发布，版权归 [Lorenzo Cabra](https://bencho.dev) 所有。
详见 [LICENSE](LICENSE) 文件。

> "Bencho" 名称和 logo 为 Lorenzo Cabra 的商标，不受本软件许可证覆盖。
> 组件中的示例图片（如加密货币图标）各有其原始版权，商用时请替换为自有素材。
