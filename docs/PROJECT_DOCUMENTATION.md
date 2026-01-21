# VERT 项目完整技术文档

## 目录

1. [项目概述与目标](#1-项目概述与目标)
2. [功能清单](#2-功能清单)
3. [模块化结构分析](#3-模块化结构分析)
4. [文件路径与实现逻辑](#4-文件路径与实现逻辑)
5. [技术架构详解](#5-技术架构详解)
6. [附录](#6-附录)

---

## 1. 项目概述与目标

### 1.1 项目简介

VERT 是一个基于 WebAssembly 的本地化文件转换工具，核心特点是使用 WebAssembly 技术在用户设备上直接进行文件格式转换，而非依赖云端服务器处理。这种架构设计确保了用户隐私安全，同时提供了无文件大小限制的转换体验。

项目采用现代前端技术栈构建，以 SvelteKit 作为核心框架，结合 TypeScript 提供类型安全保障，通过 WebAssembly 集成多种专业转换引擎（FFmpeg、ImageMagick、Pandoc），实现了对超过 250 种文件格式的支持。VERT 的设计理念强调本地优先（Local-First），所有转换操作均在浏览器或本地环境中完成，仅在视频转换等特定场景下提供可选的外部服务器处理方案。

从用户体验角度看，VERT 提供了直观的 Web 界面，支持拖拽上传、批量转换、进度追踪等功能，同时具备响应式设计，能够在不同尺寸的设备上提供一致的使用体验。项目还集成了国际化支持，覆盖包括中文（简繁体）、英语、西班牙语、法语、德语、日语、韩语在内的 15 种语言，满足全球用户的使用需求。

### 1.2 核心目标

VERT 项目的核心目标可以归纳为三个层面：隐私保护、性能优化和用户体验。在隐私保护方面，项目通过 WebAssembly 实现本地转换，确保用户的敏感文件无需上传至第三方服务器，从根本上消除了数据泄露风险。对于视频转换等计算密集型场景，项目提供了可选的自托管服务器方案（vertd），允许用户在保持数据本地化的前提下获得更强的处理能力。

性能优化是项目的另一核心目标。传统的云端文件转换服务受制于网络带宽和服务器负载，往往存在上传下载耗时较长、并发处理能力有限等问题。VERT 通过将转换引擎嵌入浏览器，充分利用用户设备的计算资源，实现了近乎即时的转换响应。项目还针对大文件处理进行了专门优化，支持流式传输和分块处理，能够稳定处理超过设备内存限制的超大文件。

用户体验层面的目标涵盖功能完备性和界面友好性两个维度。功能上，VERT 追求覆盖尽可能多的文件格式和转换场景，减少用户寻找其他工具的需要；界面上，项目强调简洁直观的设计原则，通过清晰的视觉反馈和流畅的动画效果降低学习成本，提升操作效率。

### 1.3 技术栈概述

VERT 项目的技术选型体现了现代 Web 开发的最佳实践，前端框架选用 SvelteKit 2.x 版本，充分利用其优秀的编译时优化和高效的运行时性能。Svelte 5 引入的 runes 特性被广泛应用于状态管理，提供了更精细的响应式控制能力。UI 样式采用 TailwindCSS 结合 SCSS 实现，兼顾开发效率和样式灵活性。

类型系统方面，项目全面采用 TypeScript 5.x，通过严格模式确保代码质量，编译器选项配置了完整的类型检查和现代 ES 特性支持。构建工具选用 Vite 5.x，利用其极速的热更新能力和成熟的插件生态优化开发体验。国际化方案采用 inlang Paraglide，实现轻量级的运行时多语言支持。

WebAssembly 是实现本地转换的核心技术，项目集成了多个 WASM 化的转换引擎。音频和视频转换使用 @ffmpeg/ffmpeg 0.12.x 版本，通过 WebAssembly 复现了 FFmpeg 的完整功能；图像转换使用 @imagemagick/magick-wasm 0.0.x 版本，提供专业级的图像处理能力；文档转换则使用 pandoc.wasm 实现，支持多种文档格式之间的互转。

部署层面，项目采用静态站点生成器 adapter-static，支持完全脱离服务器运行，配合 Docker 容器化方案便于自托管部署。CI/CD 流程使用 GitHub Actions 实现自动化构建和 Docker 镜像发布。

---

## 2. 功能清单

### 2.1 主要功能

VERT 项目的主要功能围绕文件格式转换这一核心需求展开，具体包括以下四大类别：

**图像转换功能**构成了项目最基础也是最全面的转换能力。借助 ImageMagick 的 WASM 实现，VERT 支持超过 80 种图像格式的相互转换，涵盖常见格式如 PNG、JPEG、GIF、WebP、SVG，专业格式如 PSD、TIFF、EPS，以及众多相机原始格式如 CR2、NEF、ARW 等。图像转换支持质量参数设置、元数据保留控制、尺寸调整等高级选项，能够满足从日常用到专业场景的各类需求。

**音频转换功能**基于 FFmpeg WASM 实现，支持约 40 种音频格式之间的转换。常见格式包括 MP3、WAV、FLAC、OGG、AAC 等无损和有损格式，以及 M4A、WMA、AMR 等特定平台格式。音频转换提供了比特率控制（支持 32kbps 至 320kbps 范围）、采样率设置（支持 8kHz 至 48kHz 及自定义值）、元数据保留等精细参数配置。

**文档转换功能**使用 Pandoc WASM 实现，支持约 15 种文档格式的互转，涵盖 Microsoft Word 格式（docx、doc）、开放文档格式（odt）、电子书格式（epub）、标记语言（md、html、rst）以及数据交换格式（csv、tsv、json）。文档转换特别支持将文件转换为包含多文件的 ZIP 压缩包，便于批量处理场景。

**视频转换功能**提供两种处理模式：本地模式依赖外部 vertd 服务器实现（可自托管），云端模式则连接 VERT 官方服务。支持的视频格式包括 MKV、MP4、AVI、MOV、WebM、WMV 等主流格式，以及 GIF 动图格式。视频转换支持转换速度调节（ultrafast 到 placebo）、元数据保留、批量处理等特性。

### 2.2 次要功能

除核心转换功能外，VERT 还提供了一系列增强用户体验的辅助功能：

**文件管理功能**支持批量上传、批量下载、文件队列管理。用户可以同时上传多个文件，系统会自动识别格式并分配至对应的转换器。转换完成后支持一键打包下载全部结果，或逐个文件下载。文件列表提供缩略图预览功能，音频文件会尝试提取专辑封面作为预览图，视频和图像文件则生成自动缩略图。

**ZIP 压缩包处理**是项目的特色功能之一。系统能够识别 ZIP 格式的压缩包，若其中所有文件均可由同一转换器处理，则将整个压缩包作为单个文件进行转换，最终生成包含所有转换后文件的压缩包。这种设计极大便利了批量转换场景，用户无需逐个解压和重命名文件。

**格式自动检测与推荐**功能简化了用户操作流程。上传文件后系统会自动识别文件格式，并根据文件类型推荐默认的目标格式。用户也可以手动选择任意支持的目标格式，系统会实时验证格式组合的合法性。

**进度追踪与取消**功能确保了转换过程的可控性。对于支持进度报告的转换器（FFmpeg、vertd），界面会实时显示转换进度百分比和详细状态信息。用户可随时取消正在进行的转换操作，系统会清理相关资源并从文件列表中移除对应文件。

**错误处理与提示**功能帮助用户理解和解决转换过程中的问题。针对常见的转换错误（如格式不支持、文件过大、采样率不兼容等），系统提供清晰的中文错误说明和建议解决方案。高级错误信息可通过详情面板查看。

**主题与效果切换**功能允许用户自定义界面外观。系统支持亮色和暗色两种主题模式，并提供动画效果开关以适应不同用户的偏好和性能需求。主题设置会持久化保存至本地存储。

### 2.3 支持的格式一览表

以下表格详细列出了各类转换器支持的全部输入输出格式。标记星号（*）的格式表示仅支持单向转换（输入或输出）。

#### 图像格式（ImageMagick）

| 格式 | 输入 | 输出 | 说明 |
|------|------|------|------|
| png | ✓ | ✓ | 便携式网络图形 |
| jpeg/jpg | ✓ | ✓ | JPEG 图像 |
| gif | ✓ | ✓ | 动图支持 |
| webp | ✓ | ✓ | WebP 图像 |
| svg | ✓ | ✓ | 可缩放矢量图形 |
| bmp | ✓ | ✓ | 位图格式 |
| tiff/tif | ✓ | ✓ | 标记图像文件格式 |
| ico | ✓ | ✓ | Windows 图标 |
| avif | ✓ | ✓ | AV1 图像格式 |
| jxl | ✓ | ✓ | JPEG XL 格式 |
| heic/heif | ✓ | * | 高效图像格式 |
| psd | ✓ | ✓ | Photoshop 文档 |
| eps | * | ✓ | 封装的 PostScript |
| hdr | ✓ | ✓ | 高动态范围图像 |
| nef | ✓ | * | 尼康 RAW 格式 |
| cr2 | ✓ | * | 佳能 RAW 格式 |
| arw | ✓ | * | 索尼 RAW 格式 |
| dng | ✓ | * | 数字负片格式 |

#### 音频格式（FFmpeg）

| 格式 | 输入 | 输出 | 说明 |
|------|------|------|------|
| mp3 | ✓ | ✓ | MP3 音频 |
| wav | ✓ | ✓ | WAV 音频 |
| flac | ✓ | ✓ | FLAC 无损 |
| ogg/oga | ✓ | ✓ | Ogg 音频 |
| opus | ✓ | ✓ | Opus 音频 |
| aac | ✓ | ✓ | AAC 音频 |
| m4a | ✓ | ✓ | MP4 音频 |
| alac | ✓ | ✓ | Apple 无损 |
| wma | ✓ | ✓ | Windows 媒体音频 |
| aiff/aif | ✓ | ✓ | AIFF 音频 |
| amr | ✓ | ✓ | AMR 音频 |
| ac3 | ✓ | ✓ | AC3 音频 |
| voc | ✓ | ✓ | VOC 音频 |
| weba | ✓ | ✓ | WebM 音频 |

#### 文档格式（Pandoc）

| 格式 | 输入 | 输出 | 说明 |
|------|------|------|------|
| docx | ✓ | ✓ | Word 文档 |
| doc | ✓ | ✓ | Word 97-2003 |
| md | ✓ | ✓ | Markdown |
| html | ✓ | ✓ | HTML 文档 |
| rtf | ✓ | ✓ | 富文本格式 |
| odt | ✓ | ✓ | OpenDocument 文本 |
| epub | ✓ | ✓ | 电子书格式 |
| docbook | ✓ | ✓ | DocBook XML |
| csv/tsv | ✓ | ✓ | 表格数据 |
| json | ✓ | ✓ | Pandoc JSON（仅输入） |
| rst | ✓ | ✓ | reStructuredText |

#### 视频格式（Vertd）

| 格式 | 输入 | 输出 | 说明 |
|------|------|------|------|
| mp4 | ✓ | ✓ | MP4 容器 |
| mkv | ✓ | ✓ | Matroska 容器 |
| avi | ✓ | ✓ | AVI 容器 |
| mov | ✓ | ✓ | QuickTime 容器 |
| webm | ✓ | ✓ | WebM 容器 |
| wmv | ✓ | ✓ | Windows 媒体视频 |
| gif | ✓ | ✓ | GIF 动图 |
| mpg/mpeg | ✓ | ✓ | MPEG 视频 |
| flv | ✓ | ✓ | Flash 视频 |
| 3gp | ✓ | ✓ | 3GPP 容器 |
| mxf | ✓ | ✓ | 素材交换格式 |
| divx | ✓ | ✓ | DivX 视频 |
| rm/rmvb | ✓ | * | RealMedia 格式 |

---

## 3. 模块化结构分析

### 3.1 项目架构总览

VERT 项目采用清晰的分层架构设计，从顶到底依次为路由层、页面层、组件层、服务层和基础设施层。这种分层结构确保了关注点分离，便于维护和扩展。

```
VERT 项目架构
├── 路由层 (src/routes)
│   ├── +layout.svelte        # 全局布局
│   ├── +page.svelte          # 首页（上传页面）
│   ├── convert/              # 转换页面
│   ├── settings/             # 设置页面
│   ├── about/                # 关于页面
│   └── privacy/              # 隐私页面
│
├── 页面层 (src/lib/sections)
│   ├── settings/             # 设置子页面
│   └── about/                # 关于子页面
│
├── 组件层 (src/lib/components)
│   ├── functional/           # 功能组件
│   ├── layout/               # 布局组件
│   └── visual/               # 视觉组件
│
├── 服务层 (src/lib)
│   ├── converters/           # 转换器模块
│   ├── store/                # 状态管理
│   ├── types/                # 类型定义
│   ├── util/                 # 工具函数
│   └── workers/              # Web Worker
│
└── 基础设施
    ├── 静态资源 (static/)    # 静态文件
    ├── 消息 (messages/)      # 国际化消息
    └── 配置                  # 配置文件
```

### 3.2 核心模块详解

#### 3.2.1 转换器模块（converters）

转换器模块是 VERT 的核心引擎层，负责实现各类文件格式的转换逻辑。该模块采用策略模式设计，通过统一的 Converter 抽象基类定义转换器接口，具体转换器实现继承该接口并提供各自的功能。

**模块结构：**

```
converters/
├── converter.svelte.ts       # 转换器基类
├── ffmpeg.svelte.ts          # 音频/视频转换器
├── magick.svelte.ts          # 图像转换器
├── magick-automated.ts       # ImageMagick 格式列表
├── pandoc.svelte.ts          # 文档转换器
├── vertd.svelte.ts           # 外部视频转换器
├── index.ts                  # 模块导出
└── vertd.svelte.ts           # Vertd 服务器通信
```

**Converter 基类**（[converter.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/converter.svelte.ts)）定义了所有转换器必须实现的接口：

- `name`: 转换器标识名称
- `supportedFormats`: 支持的格式列表（FormatInfo 对象数组）
- `status`: 转换器状态（not-ready/downloading/ready/error）
- `reportsProgress`: 是否支持进度报告
- `convert(input, to, ...)`: 执行转换的核心方法
- `cancel(input)`: 取消正在进行的转换
- `valid()`: 验证转换器是否可用

**FFmpeg 转换器**（[ffmpeg.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/ffmpeg.svelte.ts)）是实现最复杂的转换器，核心特性包括：

1. **实例管理**：维护活跃转换的 FFmpeg 实例映射，支持并行处理多个文件
2. **命令构建**：根据输入输出格式动态构建 FFmpeg 命令参数
3. **质量控制**：支持自动或手动设置音频比特率、采样率
4. **元数据处理**：可选保留或移除文件元数据
5. **特殊格式处理**：ALAC 格式特殊输出为 m4a；Opus 格式不支持 44100Hz 采样率时的自动调整
6. **封面提取**：音频转视频时尝试提取专辑封面作为视频背景

**ImageMagick 转换器**（[magick.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/magick.svelte.ts)）采用 Web Worker 模式实现图像转换：

1. **Worker 通信**：通过消息传递与 Worker 线程交互，避免阻塞主线程
2. **SVG 特殊处理**：ImageMagick WASM 不支持 SVG，输入为 SVG 时先通过 Canvas 转为 PNG 再处理
3. **ZIP 批处理**：支持将多个图像打包为 ZIP 输出
4. **超时控制**：Worker 初始化和转换过程均有超时保护

**Pandoc 转换器**（[pandoc.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/pandoc.svelte.ts)）实现文档格式转换：

1. **WASM 加载**：从静态资源加载 pandoc.wasm 文件
2. **Worker 模式**：使用 Worker 线程执行转换避免界面卡顿
3. **错误分类**：识别并转换 Pandoc 特定错误类型为用户友好的提示信息

**Vertd 转换器**（[vertd.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/vertd.svelte.ts)）处理视频文件的外部服务器转换：

1. **WebSocket 通信**：通过 WebSocket 与 vertd 服务器保持长连接
2. **上传进度**：XHR 上传文件并追踪进度
3. **实时进度**：接收服务器推送的帧级别进度更新
4. **失败限制**：防止同一文件频繁转换失败（每小时最多 3 次）
5. **取消支持**：通过 WebSocket 发送取消消息

#### 3.2.2 状态管理模块（store）

状态管理模块使用 Svelte 5 的 runes 系统实现全局状态管理，提供响应式的数据存储和访问接口。

**核心状态对象**：

| 状态名 | 类型 | 用途 |
|--------|------|------|
| `files` | Files 类实例 | 管理已上传文件队列 |
| `theme` | "light" \| "dark" | 界面主题 |
| `effects` | boolean | 动画效果开关 |
| `isMobile` | boolean | 移动设备检测 |
| `dropping` | boolean | 拖拽上传状态 |
| `vertdLoaded` | boolean | Vertd 服务器连接状态 |
| `showGradient` | boolean | 背景渐变显示 |
| `gradientColor` | string | 渐变颜色主题 |

**Files 类**（[store/index.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/store/index.svelte.ts)）是管理文件的核心类：

1. **文件添加** (`add` 方法)：支持单个文件、文件数组、FileList 多种输入形式
2. **格式识别**：自动根据文件扩展名匹配转换器
3. **ZIP 处理**：识别并解压 ZIP 压缩包，统一转换后重新打包
4. **缩略图生成**：为音频、图像、视频文件生成预览缩略图
5. **批量转换** (`convertAll` 方法)：使用 PQueue 控制并发数量
6. **批量下载** (`downloadAll` 方法)：使用 client-zip 生成下载 ZIP
7. **状态派生**：计算 `ready`（就绪）和 `results`（完成）状态

**DialogProvider**（[store/DialogProvider.ts](file:///d:/workSpace-two/VERT/src/lib/store/DialogProvider.ts)）提供全局对话框服务：

1. **对话框注册**：允许任意组件注册对话框
2. **按钮配置**：支持自定义按钮文本和回调函数
3. **类型区分**：信息、警告、错误等不同类型的对话框

#### 3.2.3 类型定义模块（types）

类型定义模块为项目提供完整的 TypeScript 类型支持，增强代码可读性和类型安全。

**核心类型**：

- **VertFile**（[file.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/types/file.svelte.ts)）：包装原生 File 对象，添加转换相关状态和方法
  - 属性：`id`、`file`、`from`、`name`、`to`、`progress`、`result`、`processing`、`converters`
  - 方法：`convert()`、`download()`、`cancel()`、`findConverter()`、`isLarge()`、`hash()`

- **Converter**：转换器基类类型（[converter.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/converter.svelte.ts)）

- **FormatInfo**：格式信息类，包含 `name`、`fromSupported`、`toSupported`、`isNative` 属性

- **WorkerMessage**：Web Worker 通信消息类型定义

#### 3.2.4 工具函数模块（util）

工具函数模块提供项目中使用的各类辅助功能：

| 文件 | 功能 |
|------|------|
| [logger.ts](file:///d:/workSpace-two/VERT/src/lib/util/logger.ts) | 统一的日志输出接口 |
| [toast.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/util/toast.svelte.ts) | 通知提示（Toast）管理 |
| [consts.ts](file:///d:/workSpace-two/VERT/src/lib/util/consts.ts) | 常量定义（GB、DISABLE_ALL_EXTERNAL_REQUESTS） |
| [ip.ts](file:///d:/workSpace-two/VERT/src/lib/util/ip.ts) | IP 地址处理 |
| [sw.ts](file:///d:/workSpace-two/VERT/src/lib/util/sw.ts) | Service Worker 相关 |
| [zip.ts](file:///d:/workSpace-two/VERT/src/lib/util/zip.ts) | ZIP 文件的创建和提取 |
| [animation.ts](file:///d:/workSpace-two/VERT/src/lib/util/animation.ts) | 动画效果工具 |
| [parse/ani.ts](file:///d:/workSpace-two/VERT/src/lib/util/parse/ani.ts) | ANI 动画解析 |
| [parse/icns/index.ts](file:///d:/workSpace-two/VERT/src/lib/util/parse/icns/index.ts) | ICNS 图标解析 |

### 3.3 组件层结构

组件层按照功能分为 functional（功能组件）、layout（布局组件）、visual（视觉组件）三个子类别：

#### 功能组件（functional）

| 组件 | 文件 | 用途 |
|------|------|------|
| [ConversionPanel.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/ConversionPanel.svelte) | 转换操作面板（批量转换/下载/清除） |
| [Uploader.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/Uploader.svelte) | 文件上传组件 |
| [FormatDropdown.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/FormatDropdown.svelte) | 格式选择下拉框 |
| [Dropdown.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/Dropdown.svelte) | 通用下拉菜单 |
| [FancyInput.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/FancyInput.svelte) | 样式化输入框 |
| [FancyMenu.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/FancyMenu.svelte) | 样式化菜单 |
| [Dialog.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/Dialog.svelte) | 对话框组件 |
| [VertdError.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/VertdError.svelte) | Vertd 错误显示 |
| [VertdErrorDetails.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/VertdErrorDetails.svelte) | Vertd 错误详情 |

#### 布局组件（layout）

| 组件 | 文件 | 用途 |
|------|------|------|
| [Navbar/](file:///d:/workSpace-two/VERT/src/lib/components/layout/Navbar/) | 导航栏（Desktop/Mobile/Base） |
| [Footer.svelte](file:///d:/workSpace-two/VERT/src/lib/components/layout/Footer.svelte) | 页脚 |
| [PageContent.svelte](file:///d:/workSpace-two/VERT/src/lib/components/layout/PageContent.svelte) | 页面内容容器 |
| [UploadRegion.svelte](file:///d:/workSpace-two/VERT/src/lib/components/layout/UploadRegion.svelte) | 上传区域 |
| [Dialogs.svelte](file:///d:/workSpace-two/VERT/src/lib/components/layout/Dialogs.svelte) | 全局对话框容器 |
| [Toasts.svelte](file:///d:/workSpace-two/VERT/src/lib/components/layout/Toasts.svelte) | Toast 通知容器 |
| [Gradients.svelte](file:///d:/workSpace-two/VERT/src/lib/components/layout/Gradients.svelte) | 背景渐变效果 |

#### 视觉组件（visual）

| 组件 | 文件 | 用途 |
|------|------|------|
| [Panel.svelte](file:///d:/workSpace-two/VERT/src/lib/components/visual/Panel.svelte) | 面板容器 |
| [ProgressBar.svelte](file:///d:/workSpace-two/VERT/src/lib/components/visual/ProgressBar.svelte) | 进度条 |
| [Toast.svelte](file:///d:/workSpace-two/VERT/src/lib/components/visual/Toast.svelte) | 单个 Toast |
| [Tooltip.svelte](file:///d:/workSpace-two/VERT/src/lib/components/visual/Tooltip.svelte) | 提示框 |
| [effects/ProgressiveBlur.svelte](file:///d:/workSpace-two/VERT/src/lib/components/visual/effects/ProgressiveBlur.svelte) | 渐进模糊效果 |
| [svg/](file:///d:/workSpace-two/VERT/src/lib/components/visual/svg/) | SVG 图标（Logo、VertVBig 等） |

### 3.4 页面模块结构

路由层定义了应用的页面结构：

```
src/routes/
├── +layout.svelte              # 全局布局（导航栏、页脚、对话框）
├── +layout.server.ts           # 服务端布局逻辑
├── +layout.ts                  # 布局类型定义
├── +page.svelte                # 首页 - 上传页面
├── convert/
│   └── +page.svelte            # 转换页面 - 文件列表和操作
├── settings/
│   └── +page.svelte            # 设置页面
├── about/
│   └── +page.svelte            # 关于页面
└── privacy/
    └── +page.svelte            # 隐私政策页面
```

**首页**（[+page.svelte](file:///d:/workSpace-two/VERT/src/routes/+page.svelte)）展示：

1. 主标题和副标题
2. 文件上传组件
3. 支持格式信息卡片（按类型分组：图像/音频/文档/视频）

**转换页面**（[convert/+page.svelte](file:///d:/workSpace-two/VERT/src/routes/convert/+page.svelte)）展示：

1. 转换操作面板（批量转换/下载/清除）
2. 文件列表（每个文件显示预览、格式选择、转换按钮）
3. 动态背景渐变（根据文件类型变化颜色）

### 3.5 模块间关系图

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      用户界面层                              │
                    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
                    │  │ 首页    │  │ 转换页  │  │ 设置页  │  │ 关于/隐私页     │ │
                    │  └────┬────┘  └────┬────┘  └────┬────┘  └───────┬─────────┘ │
                    └───────┼────────────┼────────────┼────────────────┼───────────┘
                            │            │            │                │
                            ▼            ▼            ▼                ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      组件层                                  │
                    │  ┌─────────────────────────────────────────────────────────┐  │
                    │  │ functional/                                           │  │
                    │  │  ConversionPanel ───► FormatDropdown, Uploader        │  │
                    │  └─────────────────────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      服务层（store）                         │
                    │  ┌─────────────────────────────────────────────────────────┐  │
                    │  │ Files 类                                               │  │
                    │  │  ├── 文件队列管理                                      │  │
                    │  │  ├── ZIP 处理                                          │  │
                    │  │  ├── 缩略图生成                                        │  │
                    │  │  └── 批量转换/下载                                     │  │
                    │  └─────────────────────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
    ┌───────────────┴───────┐ ┌──────┴──────┐ ┌───────┴───────┐
    │    转换器模块          │ │ 类型模块    │ │  工具函数模块  │
    │ ┌───────────────────┐ │ │ VertFile   │ │  Logger       │
    │ │ FFmpegConverter   │ │ │ FormatInfo │ │  ToastManager │
    │ │ MagickConverter   │ │ │ WorkerMsg  │ │  Zip         │
    │ │ PandocConverter   │ │ └────────────┘ │  Animation   │
    │ │ VertdConverter    │ └────────────────┴───────────────┘
    │ └───────────────────┘
    └─────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    WebAssembly 引擎                          │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
    │  │ @ffmpeg/ffmpeg│  │@imagemagick/ │  │  pandoc.wasm     │   │
    │  │              │  │  magick-wasm │  │                  │   │
    │  └──────────────┘  └──────────────┘  └──────────────────┘   │
    └─────────────────────────────────────────────────────────────┘
```

---

## 4. 文件路径与实现逻辑

### 4.1 项目根目录结构

```
VERT/
├── .github/workflows/          # GitHub Actions CI/CD 配置
│   └── docker.yml             # Docker 构建工作流
├── .vscode/                    # VS Code IDE 配置
│   ├── extensions.json         # 推荐扩展
│   ├── settings.json           # 工作区设置
│   └── tailwind.json          # TailwindCSS 探测配置
├── docs/                       # 项目文档
│   ├── images/                 # 文档用截图
│   ├── DOCKER.md              # Docker 部署文档
│   ├── FAQ.md                 # 常见问题
│   ├── GETTING_STARTED.md     # 入门指南
│   └── VIDEO_CONVERSION.md    # 视频转换说明
├── messages/                   # 国际化消息文件
│   ├── en.json                # 英语
│   ├── zh-Hans.json           # 简体中文
│   ├── zh-Hant.json           # 繁体中文
│   └── ...                    # 其他语言
├── nginx/                      # Nginx 配置
│   ├── default.conf           # 普通 HTTP 配置
│   └── default-ssl.conf       # HTTPS SSL 配置
├── project.inlang/            # inlang 国际化项目配置
├── src/                       # 源代码目录
│   ├── lib/                   # 库代码
│   │   ├── assets/            # 静态资源
│   │   ├── components/        # Svelte 组件
│   │   ├── converters/        # 转换器实现
│   │   ├── sections/          # 页面内容区
│   │   ├── store/             # 状态管理
│   │   ├── types/             # 类型定义
│   │   ├── util/              # 工具函数
│   │   └── workers/           # Web Worker
│   └── routes/                # SvelteKit 路由
├── static/                    # 静态资源（构建时复制）
├── .dockerignore              # Docker 构建忽略文件
├── .gitignore                 # Git 忽略文件
├── Dockerfile                 # Docker 构建文件
├── docker-compose.yml         # Docker Compose 配置
├── package.json               # npm 包配置
├── svelte.config.js           # SvelteKit 配置
├── tailwind.config.ts         # TailwindCSS 配置
├── tsconfig.json              # TypeScript 配置
├── vite.config.ts             # Vite 构建配置
└── README.md                  # 项目说明
```

### 4.2 核心模块文件路径

#### 转换器模块文件

| 文件路径 | 用途说明 | 关键类/函数 |
|----------|----------|-------------|
| [src/lib/converters/converter.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/converter.svelte.ts) | 转换器基类定义 | `Converter`、`FormatInfo` |
| [src/lib/converters/ffmpeg.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/ffmpeg.svelte.ts) | FFmpeg 音频/视频转换器 | `FFmpegConverter`、`CONVERSION_BITRATES`、`SAMPLE_RATES` |
| [src/lib/converters/magick.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/magick.svelte.ts) | ImageMagick 图像转换器 | `MagickConverter` |
| [src/lib/converters/magick-automated.ts](file:///d:/workSpace-two/VERT/src/lib/converters/magick-automated.ts) | ImageMagick 额外格式列表 | `imageFormats` |
| [src/lib/converters/pandoc.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/pandoc.svelte.ts) | Pandoc 文档转换器 | `PandocConverter` |
| [src/lib/converters/vertd.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/vertd.svelte.ts) | Vertd 外部服务器转换器 | `VertdConverter`、`vertdFetch` |
| [src/lib/converters/index.ts](file:///d:/workSpace-two/VERT/src/lib/converters/index.ts) | 模块导出和格式分类 | `converters`、`categories`、`byNative` |

#### 状态管理模块文件

| 文件路径 | 用途说明 | 关键类/函数 |
|----------|----------|-------------|
| [src/lib/store/index.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/store/index.svelte.ts) | 全局状态管理 | `Files` 类、`files`、`theme`、`effects` 等 |
| [src/lib/store/DialogProvider.ts](file:///d:/workSpace-two/VERT/src/lib/store/DialogProvider.ts) | 对话框服务 | `addDialog` |

#### 类型定义模块文件

| 文件路径 | 用途说明 | 关键类型 |
|----------|----------|----------|
| [src/lib/types/file.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/types/file.svelte.ts) | 文件类型定义 | `VertFile` 类、`Categories` 接口 |
| [src/lib/types/conversion-worker.ts](file:///d:/workSpace-two/VERT/src/lib/types/conversion-worker.ts) | Worker 消息类型 | `WorkerMessage` |
| [src/lib/types/index.ts](file:///d:/workSpace-two/VERT/src/lib/types/index.ts) | 导出聚合 | - |
| [src/lib/types/util.ts](file:///d:/workSpace-two/VERT/src/lib/types/util.ts) | 工具类型 | - |

#### 工具函数模块文件

| 文件路径 | 用途说明 | 关键函数 |
|----------|----------|----------|
| [src/lib/util/logger.ts](file:///d:/workSpace-two/VERT/src/lib/util/logger.ts) | 日志服务 | `log`、`error` |
| [src/lib/util/toast.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/util/toast.svelte.ts) | Toast 通知管理 | `ToastManager` |
| [src/lib/util/consts.ts](file:///d:/workSpace-two/VERT/src/lib/util/consts.ts) | 常量定义 | `GB`、`DISABLE_ALL_EXTERNAL_REQUESTS` |
| [src/lib/util/zip.ts](file:///d:/workSpace-two/VERT/src/lib/util/zip.ts) | ZIP 处理 | `extractZip`、`createZip` |
| [src/lib/util/animation.ts](file:///d:/workSpace-two/VERT/src/lib/util/animation.ts) | 动画工具 | - |
| [src/lib/util/sw.ts](file:///d:/workSpace-two/VERT/src/lib/util/sw.ts) | Service Worker | - |
| [src/lib/util/ip.ts](file:///d:/workSpace-two/VERT/src/lib/util/ip.ts) | IP 处理 | - |

#### Web Worker 文件

| 文件路径 | 用途说明 |
|----------|----------|
| [src/lib/workers/magick.ts](file:///d:/workSpace-two/VERT/src/lib/workers/magick.ts) | ImageMagick 转换 Worker |
| [src/lib/workers/pandoc.ts](file:///d:/workSpace-two/VERT/src/lib/workers/pandoc.ts) | Pandoc 转换 Worker |

#### 组件模块文件

| 文件路径 | 用途说明 |
|----------|----------|
| [src/lib/components/functional/Uploader.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/Uploader.svelte) | 文件上传组件 |
| [src/lib/components/functional/ConversionPanel.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/ConversionPanel.svelte) | 转换操作面板 |
| [src/lib/components/functional/FormatDropdown.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/FormatDropdown.svelte) | 格式选择下拉框 |
| [src/lib/components/functional/Dropdown.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/Dropdown.svelte) | 通用下拉菜单 |
| [src/lib/components/functional/Dialog.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/Dialog.svelte) | 对话框 |
| [src/lib/components/layout/Navbar/](file:///d:/workSpace-two/VERT/src/lib/components/layout/Navbar/) | 导航栏组件集 |
| [src/lib/components/layout/Footer.svelte](file:///d:/workSpace-two/VERT/src/lib/components/layout/Footer.svelte) | 页脚 |
| [src/lib/components/visual/Panel.svelte](file:///d:/workSpace-two/VERT/src/lib/components/visual/Panel.svelte) | 面板容器 |
| [src/lib/components/visual/ProgressBar.svelte](file:///d:/workSpace-two/VERT/src/lib/components/visual/ProgressBar.svelte) | 进度条 |
| [src/lib/components/visual/Tooltip.svelte](file:///d:/workSpace-two/VERT/src/lib/components/visual/Tooltip.svelte) | 提示框 |

#### 页面路由文件

| 文件路径 | 用途说明 |
|----------|----------|
| [src/routes/+page.svelte](file:///d:/workSpace-two/VERT/src/routes/+page.svelte) | 首页 |
| [src/routes/convert/+page.svelte](file:///d:/workSpace-two/VERT/src/routes/convert/+page.svelte) | 转换页面 |
| [src/routes/settings/+page.svelte](file:///d:/workSpace-two/VERT/src/routes/settings/+page.svelte) | 设置页面 |
| [src/routes/about/+page.svelte](file:///d:/workSpace-two/VERT/src/routes/about/+page.svelte) | 关于页面 |
| [src/routes/privacy/+page.svelte](file:///d:/workSpace-two/VERT/src/routes/privacy/+page.svelte) | 隐私页面 |
| [src/routes/+layout.svelte](file:///d:/workSpace-two/VERT/src/routes/+layout.svelte) | 全局布局 |

#### 配置文件

| 文件路径 | 用途说明 |
|----------|----------|
| [package.json](file:///d:/workSpace-two/VERT/package.json) | 项目依赖和脚本 |
| [svelte.config.js](file:///d:/workSpace-two/VERT/svelte.config.js) | SvelteKit 配置 |
| [vite.config.ts](file:///d:/workSpace-two/VERT/vite.config.ts) | Vite 构建配置 |
| [tsconfig.json](file:///d:/workSpace-two/VERT/tsconfig.json) | TypeScript 配置 |
| [tailwind.config.ts](file:///d:/workSpace-two/VERT/tailwind.config.ts) | TailwindCSS 配置 |
| [Dockerfile](file:///d:/workSpace-two/VERT/Dockerfile) | Docker 构建镜像 |
| [docker-compose.yml](file:///d:/workSpace-two/VERT/docker-compose.yml) | Docker Compose 服务编排 |

### 4.3 核心实现逻辑概述

#### 4.3.1 文件上传与处理流程

文件上传流程的入口是 [Uploader.svelte](file:///d:/workSpace-two/VERT/src/lib/components/functional/Uploader.svelte) 组件。当用户选择文件后，handleFileChange 事件处理器被触发，调用 `files.add()` 方法将文件添加到队列。

在 `Files.add()` 方法中，系统首先检查文件是否为 ZIP 格式。若是 ZIP，则调用 `_handleZipFile()` 方法提取压缩包内容，检查其中所有文件的兼容性：
- 如果所有文件可由同一转换器处理，则将 ZIP 作为单个 VertFile 添加
- 否则，将 ZIP 内容解压后逐个添加为独立文件

对于普通文件，系统根据文件扩展名识别格式：
1. 在 converters 列表中查找支持该输入格式的转换器
2. 选择第一个支持该格式的转换器（按原生格式优先排序）
3. 自动设置默认的目标格式（排除输入格式外的第一个可用格式）
4. 创建 VertFile 实例并添加到队列

缩略图生成在后台异步进行，通过 PQueue 控制并发：
- 音频文件：使用 music-metadata 库提取专辑封面
- 视频/图像文件：使用 Canvas 生成缩略图
- 完全透明的图像跳过缩略图生成

#### 4.3.2 格式转换流程

格式转换的核心实现在 VertFile.convert() 方法中。流程如下：

1. **验证准备状态**：检查转换器是否就绪
2. **查找转换器**：调用 findConverter() 方法选择合适的转换器
3. **执行转换**：调用 converter.convert(input, to, ...) 执行实际转换
4. **处理结果**：将转换结果存储到 result 属性
5. **错误处理**：捕获异常并显示 Toast 通知

对于 ZIP 文件的转换，系统采用特殊的处理流程：
1. 解压 ZIP 文件
2. 使用 PQueue 并行转换所有文件
3. 追踪每个文件的进度并计算总体进度
4. 转换完成后重新打包为 ZIP

#### 4.3.3 FFmpeg 转换器实现细节

FFmpeg 转换器的核心逻辑在 [ffmpeg.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/ffmpeg.svelte.ts) 中：

**初始化阶段**：
- 创建 FFmpeg 实例
- 从 CDN 加载核心 WASM 文件
- 设置状态为 downloading，完成后设为 ready

**转换命令构建**（buildConversionCommand 方法）：
- 根据输入输出格式确定编解码器
- 处理音频比特率和采样率参数
- 添加元数据处理参数
- 视频转音频：只映射音频流
- 音频转视频：尝试使用专辑封面或纯色背景
- 处理特殊情况（如 ALAC 输出为 m4a、Opus 采样率调整）

**执行阶段**：
- 将输入文件写入 FFmpeg 虚拟文件系统
- 执行 FFmpeg 命令
- 监听日志输出，处理错误
- 读取输出文件并清理资源

#### 4.3.4 ImageMagick 转换器实现细节

ImageMagick 转换器的核心逻辑在 [magick.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/magick.svelte.ts) 中：

**初始化阶段**：
- 获取 WASM 文件 URL
- 获取用户设置的质量参数
- 异步加载 WASM 文件

**SVG 特殊处理**：
- SVG 格式不能直接由 ImageMagick WASM 处理
- 系统使用 Canvas API 将 SVG 渲染为 PNG
- 然后递归调用 convert() 方法处理 PNG 文件

**Worker 通信模式**：
- 创建 MagickWorker 专用 Worker
- 通过 postMessage 传递消息
- 消息类型包括：load（WASM 加载）、convert（执行转换）
- 等待 Worker 返回 finished 或 error 消息

**ZIP 支持**：
- ImageMagick 可以输出多个文件（如图层分离）
- 系统将多个输出文件打包为 ZIP

#### 4.3.5 Vertd 外部服务器转换实现

Vertd 转换器在 [vertd.svelte.ts](file:///d:/workSpace-two/VERT/src/lib/converters/vertd.svelte.ts) 中实现，处理需要外部服务器的视频转换：

**准备阶段**：
- 检查服务器 URL 配置
- 验证服务器可用性
- 检查文件是否被限流（每小时最多失败 3 次）

**上传阶段**：
- 使用 XMLHttpRequest 上传文件（支持进度追踪）
- 服务器返回 job ID 和认证 token

**转换阶段**：
- 建立 WebSocket 长连接
- 发送 startJob 消息启动转换
- 接收服务器的 progressUpdate 消息更新进度
- 支持通过 cancelJob 消息取消转换

**下载阶段**：
- 转换完成后从服务器下载结果文件
- 使用 XMLHttpRequest 下载并追踪进度
- 返回转换后的 VertFile 对象

#### 4.3.6 状态响应式更新机制

项目使用 Svelte 5 的 runes 系统实现响应式状态：

```typescript
// 状态声明
class Files {
    public files = $state<VertFile[]>([]);
    public ready = $derived(/* 计算逻辑 */);
}

// 派生状态
const requiredConverters = $derived(
    Array.from(new Set(files.files.map((f) => f.converters).flat()))
);
```

状态变更自动触发依赖该状态的 UI 更新，无需手动调用更新函数。$effect 钩子用于处理副作用逻辑，如初始化时恢复设置、页面导航时更新状态等。

---

## 5. 技术架构详解

### 5.1 WebAssembly 集成架构

VERT 项目将 WebAssembly 技术作为实现本地转换的核心。WASM 模块的加载和管理遵循以下架构：

```
浏览器环境
├── 主线程 (UI)
│   ├── Converter 实例管理
│   ├── 状态管理
│   └── UI 渲染
│
├── Web Worker 线程
│   ├── MagickWorker (ImageMagick)
│   ├── PandocWorker (Pandoc)
│   └── FFmpeg (主线程实例化)
│
└── 外部服务
    └── Vertd Server (WebSocket)
```

**WASM 加载策略**：
- FFmpeg：在主线程实例化但通过延迟加载优化初始页面加载速度
- ImageMagick：通过 Worker 线程隔离，避免阻塞 UI
- Pandoc：Worker 模式，支持长时间运行的转换任务

### 5.2 国际化架构

项目采用 inlang Paraglide 实现轻量级国际化：

```
messages/
├── en.json           # 英语（基础语言）
├── zh-Hans.json      # 简体中文
├── zh-Hant.json      # 繁体中文
└── ...               # 其他 12 种语言
```

**翻译消息使用**：
```typescript
import { m } from "$lib/paraglide/messages";
// 使用消息键访问翻译
m["convert.panel.convert_all"]();
```

消息键采用分层命名规范，按模块和功能组织，便于维护和查找。

### 5.3 主题与样式架构

项目使用 TailwindCSS 结合 CSS 变量实现主题系统：

```css
:root {
    --bg-primary: #ffffff;
    --bg-panel: #f3f4f6;
    --text-primary: #111827;
    --accent-blue: #3b82f6;
    /* ... */
}

.dark {
    --bg-primary: #111827;
    --bg-panel: #1f2937;
    --text-primary: #f9fafb;
}
```

组件样式使用 TailwindCSS 工具类，复杂样式通过 SCSS @apply 规则封装。

### 5.4 部署架构

项目支持多种部署方式：

**静态站点部署**：
- 使用 @sveltejs/adapter-static 生成纯静态文件
- 可部署至任何静态托管服务（GitHub Pages、Vercel、Netlify 等）

**Docker 部署**：
```yaml
# docker-compose.yml
services:
  vert:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PUB_DISABLE_FAILURE_BLOCKS=false
```

**Nginx 反向代理**（可选）：
- 配置 SSL 证书
- 添加安全头
- 优化缓存策略

---

## 6. 附录

### 6.1 依赖项清单

**主要运行时依赖**：

| 包名 | 版本 | 用途 |
|------|------|------|
| @ffmpeg/ffmpeg | ^0.12.15 | FFmpeg WASM 音频/视频转换 |
| @ffmpeg/util | ^0.12.2 | FFmpeg 工具函数 |
| @imagemagick/magick-wasm | ^0.0.37 | ImageMagick WASM 图像转换 |
| @stripe/stripe-js | ^8.5.2 | Stripe 支付集成 |
| byte-data | ^19.0.1 | 二进制数据处理 |
| client-zip | ^2.5.0 | 客户端 ZIP 生成 |
| clsx | ^2.1.1 | CSS 类名拼接 |
| fflate | ^0.8.2 | ZIP 压缩/解压 |
| lucide-svelte | ^0.554.0 | 图标库 |
| music-metadata | ^11.10.3 | 音频元数据解析 |
| overlayscrollbars | ^2.12.0 | 自定义滚动条 |
| p-queue | ^9.0.1 | 并发队列控制 |
| sanitize-html | ^2.17.0 | HTML 消毒 |
| svelte-stripe | ^1.4.0 | Stripe Svelte 集成 |
| vert-wasm | ^0.0.2 | Vert 自定义 WASM |
| vite-plugin-wasm | ^3.5.0 | Vite WASM 插件 |

**主要开发依赖**：

| 包名 | 版本 | 用途 |
|------|------|------|
| @sveltejs/kit | ^2.49.0 | Svelte 应用框架 |
| @sveltejs/adapter-static | ^3.0.10 | 静态站点适配器 |
| svelte | ^5.43.14 | Svelte 核心库 |
| typescript | ^5.9.3 | TypeScript 编译器 |
| vite | ^5.4.21 | 构建工具 |
| tailwindcss | ^3.4.18 | CSS 框架 |
| eslint | ^9.39.1 | 代码检查 |
| prettier | ^3.6.2 | 代码格式化 |
| sass | ^1.94.2 | SCSS 编译器 |

### 6.2 构建脚本说明

项目在 package.json 中定义了以下 npm 脚本：

| 脚本 | 命令 | 用途 |
|------|------|------|
| `dev` | `vite dev` | 启动开发服务器 |
| `build` | `paraglide-js compile && vite build` | 生产构建 |
| `preview` | `vite preview` | 预览构建产物 |
| `check` | `svelte-kit sync && svelte-check` | 类型检查 |
| `check:watch` | `svelte-kit sync && svelte-check --watch` | 监听模式类型检查 |
| `format` | `prettier --write .` | 格式化代码 |
| `lint` | `prettier --check . && eslint .` | 代码检查 |

### 6.3 环境变量配置

项目使用环境变量控制功能开关：

| 变量名 | 类型 | 默认值 | 用途 |
|--------|------|--------|------|
| `PUB_DISABLE_FAILURE_BLOCKS` | boolean | false | 禁用失败阻止机制 |
| `SOURCE_COMMIT` | string | - | 构建时注入 Git 提交哈希 |
| `PRI_VERTD_URL` | string | - | Vertd 服务器私有 URL |
| `PUB_VERTD_URL` | string | - | Vertd 服务器公共 URL |

### 6.4 浏览器兼容性

项目需要支持以下现代浏览器特性：

- **WebAssembly**：核心转换功能依赖
- **Web Workers**：ImageMagick 和 Pandoc 转换使用
- **WebSocket**：Vertd 服务器通信使用
- **File API**：文件上传和处理使用
- **Canvas API**：SVG 转换和缩略图生成使用
- **CSS Grid/Flexbox**：界面布局使用

建议使用最新版 Chrome、Firefox、Edge 或 Safari 以获得最佳体验。

### 6.5 常见问题索引

| 问题类别 | 相关文件 | 参考文档 |
|----------|----------|----------|
| 视频转换失败 | vertd.svelte.ts | [docs/VIDEO_CONVERSION.md](file:///d:/workSpace-two/VERT/docs/VIDEO_CONVERSION.md) |
| Docker 部署 | Dockerfile, docker-compose.yml | [docs/DOCKER.md](file:///d:/workSpace-two/VERT/docs/DOCKER.md) |
| 格式不支持 | converter.svelte.ts | [docs/FAQ.md](file:///d:/workSpace-two/VERT/docs/FAQ.md) |
| 内存不足 | store/index.svelte.ts | [docs/GETTING_STARTED.md](file:///d:/workSpace-two/VERT/docs/GETTING_STARTED.md) |

---

*文档版本：1.0*  
*最后更新：2026年1月*  
*项目地址：https://github.com/VERT-sh/VERT*
