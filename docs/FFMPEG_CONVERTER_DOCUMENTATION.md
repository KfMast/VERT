# FFmpeg 转换器实现文档

## 概述

`ffmpeg.svelte.ts` 是一个基于 WebAssembly 的音视频格式转换器实现，使用 `@ffmpeg/ffmpeg` 库在浏览器中执行转换操作。该转换器支持多种音频和视频格式之间的相互转换，并提供丰富的转换选项。

## 主要功能

### 1. 支持的格式

#### 音频格式
- **常见格式**: mp3, wav, flac, ogg, opus, aac, m4a
- **无损格式**: flac, alac (输出为 m4a), wav
- **其他格式**: wma, amr, ac3, aiff, aifc, aif, mp2, m4b, voc, weba
- **DSD 格式**: dsd, dsf, dff, mqa

#### 视频格式
- **容器格式**: mkv, mp4, avi, mov, webm, ts, mts, m2ts, wmv, mpg, mpeg, flv, f4v, vob, m4v, 3gp, 3g2, mxf, ogv, rm, rmvb, divx

### 2. 核心特性

- **浏览器内转换**: 使用 WebAssembly 在浏览器中执行转换，无需服务器
- **进度报告**: 实时显示转换进度
- **智能参数检测**: 自动检测输入文件的比特率和采样率
- **元数据处理**: 支持保留或移除元数据和专辑封面
- **视频生成**: 可将音频转换为视频，支持使用专辑封面或纯色背景
- **错误处理**: 完善的错误检测和用户提示机制

## 类结构

### FFmpegConverter 类

继承自 `Converter` 基类，实现了以下主要属性和方法：

#### 属性

```typescript
private ffmpeg: FFmpeg              // FFmpeg 实例
public name = "ffmpeg"              // 转换器名称
public ready = $state(false)        // 就绪状态
private activeConversions: Map      // 活跃转换映射
public supportedFormats             // 支持的格式列表
public readonly reportsProgress = true  // 支持进度报告
```

#### 主要方法

### 构造函数

```typescript
constructor()
```

**功能**:
- 初始化 FFmpeg 实例
- 预加载 FFmpeg WASM 文件（从 CDN）
- 设置状态为 "downloading" → "ready"
- 错误处理和用户提示

**加载源**:
```
https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm
```

### convert()

```typescript
public async convert(input: VertFile, to: string): Promise<VertFile>
```

**功能**: 执行格式转换

**参数**:
- `input`: 输入文件对象
- `to`: 目标格式（如 ".mp3"）

**流程**:
1. 处理 ALAC 格式特殊情况（转换为 m4a）
2. 设置 FFmpeg 实例
3. 监听转换过程中的错误
4. 将输入文件写入虚拟文件系统
5. 构建并执行 FFmpeg 命令
6. 读取输出文件
7. 清理资源并返回结果

**错误处理**:
- 无效采样率
- 无音频流
- 编解码器错误
- 空文件输出

### cancel()

```typescript
public async cancel(input: VertFile): Promise<void>
```

**功能**: 取消正在进行的转换

**实现**:
- 查找活跃的转换实例
- 调用 `terminate()` 终止 FFmpeg 进程
- 从活跃转换映射中移除

### setupFFmpeg()

```typescript
private async setupFFmpeg(input: VertFile): Promise<FFmpeg>
```

**功能**: 配置 FFmpeg 实例

**配置项**:
- 进度监听器（更新文件进度）
- 日志监听器（记录转换日志）
- 加载 FFmpeg 核心

### detectAudioBitrate()

```typescript
private async detectAudioBitrate(ffmpeg: FFmpeg): Promise<number | null>
```

**功能**: 检测输入文件的音频比特率

**实现**:
- 使用 ffprobe 分析音频流
- 返回比特率（kbps）
- 失败时返回 null

### detectAudioSampleRate()

```typescript
private async detectAudioSampleRate(ffmpeg: FFmpeg): Promise<number | null>
```

**功能**: 检测输入文件的音频采样率

**实现**:
- 使用 ffprobe 分析音频流
- 返回采样率（Hz）
- 失败时返回 null

### buildConversionCommand()

```typescript
private async buildConversionCommand(
  ffmpeg: FFmpeg,
  input: VertFile,
  to: string,
  isAlac: boolean = false
): Promise<string[]>
```

**功能**: 构建 FFmpeg 转换命令

**支持的转换类型**:

#### 1. 视频到音频
```bash
ffmpeg -i input -map 0:a:0 [metadata] [bitrate] [samplerate] output
```
- 提取音频流
- 可选保留/移除元数据
- 应用比特率和采样率设置

#### 2. 音频到视频
```bash
# 有专辑封面
ffmpeg -loop 1 -i cover.jpg -i input -vf scale=... -shortest -pix_fmt yuv420p -r 1 [codec] [metadata] [bitrate] [samplerate] output

# 无专辑封面
ffmpeg -f lavfi -i color=c=black:s=512x512:rate=1 -i input -shortest -pix_fmt yuv420p -r 1 [codec] [metadata] [bitrate] [samplerate] output
```
- 使用专辑封面或纯色背景
- 调整视频尺寸为偶数
- 设置 1 fps 帧率

#### 3. 音频到音频
```bash
ffmpeg -i input [m4a_args] -c:a [codec] [metadata] [bitrate] [samplerate] output
```
- 应用音频编解码器
- 可选保留专辑封面（m4a 格式）

**参数配置**:

##### 比特率设置
- **用户设置**: 使用用户指定的比特率
- **自动检测**: 从输入文件检测比特率
- **无损到有损**: 默认 128 kbps

##### 采样率设置
- **用户设置**: 使用用户指定的采样率
- **自动检测**: 从输入文件检测采样率
- **特殊处理**: Opus 格式不支持 44100Hz，自动调整为 48000Hz

##### 元数据处理
- **保留**: 保留元数据、章节、专辑封面
- **移除**: 清除所有元数据信息

### extractAlbumArt()

```typescript
private async extractAlbumArt(ffmpeg: FFmpeg): Promise<boolean>
```

**功能**: 从音频文件提取专辑封面

**尝试方法**:
1. 使用流映射提取（`-map 0:1`）
2. 回退方法：不使用流映射

**返回**: 是否成功提取封面

### tryExtractAlbumArt()

```typescript
private async tryExtractAlbumArt(ffmpeg: FFmpeg, command: string[]): Promise<boolean>
```

**功能**: 尝试执行专辑封面提取命令

**实现**:
- 执行 FFmpeg 命令
- 检查输出文件大小
- 返回是否成功

## 辅助函数

### toArgs()

```typescript
const toArgs = (ext: string, isAlac: boolean = false): string[]
```

**功能**: 根据目标格式生成编解码器参数

**编解码器配置**:

| 视频编解码器 | 参数 |
|------------|------|
| libx264 | `-preset ultrafast -crf 18 -tune stillimage` |
| libvpx | 使用 libvpx-vp9 |
| mpeg2video | MXF 格式强制 48kHz 采样率 |

### getCodecs()

```typescript
const getCodecs = (ext: string, isAlac: boolean = false): { video: string; audio: string }
```

**功能**: 返回指定格式的视频和音频编解码器

**编解码器映射**:

| 格式 | 视频编解码器 | 音频编解码器 |
|------|------------|------------|
| mp4, mkv, mov, mts, ts, m2ts, flv, f4v, m4v, 3gp, 3g2 | libx264 | aac |
| wmv | wmv2 | wmav2 |
| webm | libvpx | libvorbis |
| ogv | libtheora | libvorbis |
| avi, divx | mpeg4 | libmp3lame |
| mpg, mpeg, vob | mpeg2video | mp2 |
| mxf | mpeg2video | pcm_s16le |
| mp3 | libx264 | libmp3lame |
| flac | libx264 | flac |
| wav | libx264 | pcm_s16le |
| ogg, oga | libx264 | libvorbis |
| opus | libx264 | libopus |
| aac | libx264 | aac |
| m4a | libx264 | aac/alac |
| alac | libx264 | alac |
| wma | libx264 | wmav2 |

## 常量定义

### CONVERSION_BITRATES

```typescript
export const CONVERSION_BITRATES = [
  "auto", 320, 256, 192, 128, 96, 64, 32
] as const;
```

支持的比特率选项（kbps）。

### SAMPLE_RATES

```typescript
export const SAMPLE_RATES = [
  "auto", "custom", "48000", "44100", "32000", "22050", "16000", "11025", "8000"
] as const;
```

支持的采样率选项（Hz）。

## 使用示例

### 基本转换

```typescript
const converter = new FFmpegConverter();

// 等待转换器就绪
await converter.ready;

// 转换文件
const inputFile = new VertFile(file, ".wav");
const outputFile = await converter.convert(inputFile, ".mp3");
```

### 带进度监听

```typescript
const converter = new FFmpegConverter();
converter.reportsProgress = true;

const inputFile = new VertFile(file, ".flac");

// 监听进度
inputFile.progress = 0; // 0-100

const outputFile = await converter.convert(inputFile, ".mp3");
console.log(`转换进度: ${inputFile.progress}%`);
```

### 取消转换

```typescript
const converter = new FFmpegConverter();

const inputFile = new VertFile(file, ".wav");
const conversionPromise = converter.convert(inputFile, ".mp3");

// 取消转换
await converter.cancel(inputFile);
```

## 技术细节

### 虚拟文件系统

FFmpeg 使用内存中的虚拟文件系统：
- 输入文件: `input`
- 输出文件: `output.{ext}`
- 专辑封面: `cover.jpg`

### 错误处理机制

转换过程中监听 FFmpeg 日志，检测以下错误：
- 不支持的采样率
- 缺少音频流
- 编解码器初始化失败
- 流处理错误
- 通用转换错误

### 性能优化

1. **预加载**: 构造函数中预加载 FFmpeg WASM
2. **独立实例**: 每个转换使用独立的 FFmpeg 实例
3. **资源清理**: 转换完成后终止实例并清理监听器
4. **并发支持**: 使用 Map 跟踪活跃转换，支持并发操作

## 依赖项

- `@ffmpeg/ffmpeg`: FFmpeg WebAssembly 绑定
- `$app/environment`: SvelteKit 环境检测
- `$lib/types`: 类型定义
- `$lib/util/logger`: 日志工具
- `$lib/paraglide/messages`: 国际化消息
- `$lib/sections/settings`: 设置管理
- `$lib/util/toast.svelte`: 通知管理

## 注意事项

1. **浏览器兼容性**: 需要支持 WebAssembly 的现代浏览器
2. **内存使用**: 大文件转换可能消耗较多内存
3. **网络依赖**: 首次加载需要从 CDN 下载 FFmpeg WASM
4. **格式限制**: 某些格式可能存在编解码器限制
5. **采样率**: Opus 格式不支持 44100Hz，会自动调整为 48000Hz

## 开发者注释

代码中包含有趣的开发者注释，反映了实现过程中的挑战：

```typescript
// and here i was, thinking i'd be done with ffmpeg after finishing vertd
// but OH NO we just HAD to have someone suggest to allow album art video generation.
//
// i hate you SO much.
// - love, maddie
```

这表明专辑封面视频生成功能是后期添加的复杂特性。

## 总结

`FFmpegConverter` 是一个功能强大的浏览器端音视频转换器，提供了：
- 广泛的格式支持
- 智能参数检测
- 灵活的配置选项
- 完善的错误处理
- 实时进度反馈

该实现充分利用了 WebAssembly 技术，在浏览器中实现了复杂的音视频处理功能，为用户提供了便捷的格式转换体验。
