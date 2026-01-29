// 导入必要的类型和工具
import { VertFile } from "$lib/types";
import { Converter, FormatInfo } from "./converter.svelte";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { browser } from "$app/environment";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import { Settings } from "$lib/sections/settings/index.svelte";
import { ToastManager } from "$lib/util/toast.svelte";

// TODO: 在 UI 中区分？（非原生格式）
// 支持的视频格式列表
const videoFormats = [
	"mkv",
	"mp4",
	"avi",
	"mov",
	"webm",
	"ts",
	"mts",
	"m2ts",
	"wmv",
	"mpg",
	"mpeg",
	"flv",
	"f4v",
	"vob",
	"m4v",
	"3gp",
	"3g2",
	"mxf",
	"ogv",
	"rm",
	"rmvb",
	"divx",
];

// FFmpeg 转换器类，继承自 Converter 基类
export class LocalFFmpegConverter extends Converter {
	private ffmpeg: FFmpeg = null!; // FFmpeg 实例
	public name = "local-ffmpeg"; // 转换器名称
	public ready = $state(false); // 就绪状态，使用 Svelte 的响应式状态

	private activeConversions = new Map<string, FFmpeg>(); // 活跃转换映射，跟踪正在进行的转换

	// 支持的格式列表
	public supportedFormats = [
		new FormatInfo("mkv", true, true),
		new FormatInfo("mp4", true, true),
		new FormatInfo("webm", true, true),
		new FormatInfo("avi", true, true),
		new FormatInfo("wmv", true, true),
		new FormatInfo("mov", true, true),
		new FormatInfo("gif", true, true),
		new FormatInfo("mts", true, true),
		new FormatInfo("ts", true, true),
		new FormatInfo("m2ts", true, true),
		new FormatInfo("mpg", true, true),
		new FormatInfo("mpeg", true, true),
		new FormatInfo("flv", true, true),
		new FormatInfo("f4v", true, true),
		new FormatInfo("vob", true, true),
		new FormatInfo("m4v", true, true),
		new FormatInfo("3gp", true, true),
		new FormatInfo("3g2", true, true),
		new FormatInfo("mxf", true, true),
		new FormatInfo("ogv", true, true),
		new FormatInfo("rm", true, false),
		new FormatInfo("rmvb", true, false),
		new FormatInfo("h264", true, true),
		new FormatInfo("divx", true, true),
		new FormatInfo("swf", true, true),
		new FormatInfo("amv", true, true),
		new FormatInfo("asf", true, true),
		new FormatInfo("nut", true, true),
		// 添加所有视频格式（仅作为输入和输出，不作为原生格式）
		// ...videoFormats.map((f) => new FormatInfo(f, true, true, false)),
	];

	public readonly reportsProgress = true; // 支持进度报告

	// 构造函数：初始化 FFmpeg 转换器
	constructor() {
		super();
		log(["converters", this.name], `created converter`);
		// 如果不在浏览器环境中，直接返回
		if (!browser) return;
		try {
			// 创建 FFmpeg 实例，仅用于缓存 WASM 和 JS 文件，实际转换时会创建新实例
			this.ffmpeg = new FFmpeg();
			(async () => {
				// FFmpeg 核心文件的 CDN 地址
				const baseURL =
					// "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
					"http://192.168.2.242:5173/ffmpeg";

				// 设置状态为下载中
				this.status = "downloading";

				// 加载 FFmpeg WASM 核心文件
				await this.ffmpeg.load({
					coreURL: `${baseURL}/ffmpeg-core.js`,
					wasmURL: `${baseURL}/ffmpeg-core.wasm`,
				});

				// 设置状态为就绪
				this.status = "ready";
			})();
		} catch (err) {
			// 加载失败时的错误处理
			error(["converters", this.name], `Error loading ffmpeg: ${err}`);
			this.status = "error";
			// 显示错误提示
			ToastManager.add({
				type: "error",
				message: m["workers.errors.ffmpeg"](),
			});
		}
	}

	// 执行格式转换
	public async convert(input: VertFile, to: string): Promise<VertFile> {
		// 确保目标格式以点开头
		if (!to.startsWith(".")) to = `.${to}`;

		// 处理 ALAC 格式特殊情况（输出为 m4a）
		const isAlac = to === ".alac";
		if (isAlac) to = ".m4a";

		let conversionError: string | null = null;
		// 设置 FFmpeg 实例
		const ffmpeg = await this.setupFFmpeg(input);

		// 将转换添加到活跃转换映射
		this.activeConversions.set(input.id, ffmpeg);

		// 监听转换过程中的错误
		const errorListener = (l: { message: string }) => {
			const msg = l.message;
			// 检测不支持的采样率错误
			if (
				msg.includes("Specified sample rate") &&
				msg.includes("is not supported")
			) {
				const rate = Settings.instance.settings.ffmpegCustomSampleRate;
				conversionError = m["workers.errors.invalid_rate"]({
					rate,
				});
			// 检测无音频流错误
			} else if (msg.includes("Stream map '0:a:0' matches no streams.")) {
				conversionError = m["workers.errors.no_audio"]();
			// 检测其他通用错误
			} else if (
				msg.includes("Error initializing output stream") ||
				msg.includes("Error while opening encoder") ||
				msg.includes("Error while opening decoder") ||
				(msg.includes("Error") && msg.includes("stream")) ||
				msg.includes("Conversion failed!")
			) {
				// other general errors
				if (!conversionError) conversionError = msg;
			}
		};

		// 注册错误监听器
		ffmpeg.on("log", errorListener);

		// 将输入文件写入 FFmpeg 虚拟文件系统
		const buf = new Uint8Array(await input.file.arrayBuffer());
		await ffmpeg.writeFile("input", buf);
		log(
			["converters", this.name],
			`wrote ${input.name} to ffmpeg virtual fs`,
		);

		// 构建转换命令
		const command = await this.buildConversionCommand(
			ffmpeg,
			input,
			to,
			isAlac,
		);
		log(["converters", this.name], `FFmpeg command: ${command.join(" ")}`);
		// 执行 FFmpeg 命令
		await ffmpeg.exec(command);
		log(["converters", this.name], "executed ffmpeg command");

		// 如果有错误，抛出异常
		if (conversionError) {
			ffmpeg.off("log", errorListener);
			ffmpeg.terminate();
			throw new Error(conversionError);
		}

		// 读取输出文件
		const output = (await ffmpeg.readFile(
			"output" + to,
		)) as unknown as Uint8Array;

		// 检查输出文件是否为空
		if (!output || output.length === 0) {
			ffmpeg.off("log", errorListener);
			ffmpeg.terminate();
			throw new Error("empty file returned");
		}

		// 生成输出文件名
		const outputFileName =
			input.name.split(".").slice(0, -1).join(".") + to;
		log(
			["converters", this.name],
			`read ${outputFileName} from ffmpeg virtual fs`,
		);

		// 清理资源
		ffmpeg.off("log", errorListener);
		ffmpeg.terminate();

		// 返回转换后的文件
		const outBuf = new Uint8Array(output).buffer.slice(0);
		return new VertFile(new File([outBuf], outputFileName), to);
	}

	// 取消正在进行的转换
	public async cancel(input: VertFile): Promise<void> {
		// 从活跃转换映射中获取 FFmpeg 实例
		const ffmpeg = this.activeConversions.get(input.id);
		if (!ffmpeg) {
			error(
				["converters", this.name],
				`no active conversion found for file ${input.name}`,
			);
			return;
		}

		log(
			["converters", this.name],
			`cancelling conversion for file ${input.name}`,
		);

		// 终止 FFmpeg 进程
		ffmpeg.terminate();
		// 从活跃转换映射中移除
		this.activeConversions.delete(input.id);
	}

	// 设置 FFmpeg 实例并配置监听器
	private async setupFFmpeg(input: VertFile): Promise<FFmpeg> {
		// 创建新的 FFmpeg 实例
		const ffmpeg = new FFmpeg();

		// 监听转换进度
		ffmpeg.on("progress", (progress) => {
			input.progress = progress.progress * 100;
		});

		// 监听日志输出
		ffmpeg.on("log", (l) => {
			log(["converters", this.name], l.message);
		});

		// 加载 FFmpeg 核心
		const baseURL =
			// "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
			"http://192.168.2.242:5173/ffmpeg"
		await ffmpeg.load({
			coreURL: `${baseURL}/ffmpeg-core.js`,
			wasmURL: `${baseURL}/ffmpeg-core.wasm`,
		});

		return ffmpeg;
	}

	// 检测音频比特率
	private async detectAudioBitrate(ffmpeg: FFmpeg): Promise<number | null> {
		// 构建 ffprobe 命令参数
		const args = [
			"-v", "quiet", // 静默模式
			"-select_streams", "a:0", // 选择第一个音频流
			"-show_entries", "stream=bit_rate", // 显示比特率
			"-of", "default=noprint_wrappers=1:nokey=1", // 输出格式
			"input",
		];

		try {
			let bitrate: number | null = null;

			// 比特率监听器
			const bitrateListener = (event: { message: string }) => {
				if (bitrate !== null) return;
				const n = parseInt(event.message.trim(), 10);
				if (!n) return;
				// 将比特率转换为 kbps
				bitrate = Math.round(n / 1000);
				log(
					["converters", this.name],
					`Detected stream audio bitrate: ${bitrate} kbps`,
				);
			};

			// 注册监听器
			ffmpeg.on("log", bitrateListener);

			try {
				// 执行 ffprobe 命令
				await ffmpeg.ffprobe.call(ffmpeg, args);
				return bitrate;
			} finally {
				// 清理监听器
				ffmpeg.off("log", bitrateListener);
			}
		} catch {
			// 检测失败返回 null
			return null;
		}
	}

	// 检测音频采样率
	private async detectAudioSampleRate(
		ffmpeg: FFmpeg,
	): Promise<number | null> {
		// 构建 ffprobe 命令参数
		const args = [
			"-v", "quiet", // 静默模式
			"-select_streams", "a:0", // 选择第一个音频流
			"-show_entries", "stream=sample_rate", // 显示采样率
			"-of", "default=noprint_wrappers=1:nokey=1", // 输出格式
			"input",
		];

		try {
			let sampleRate: number | null = null;

			// 采样率监听器
			const sampleRateListener = (event: { message: string }) => {
				if (sampleRate !== null) return;
				const n = parseInt(event.message.trim(), 10);
				if (!n) return;
				sampleRate = n;
				log(
					["converters", this.name],
					`Detected stream audio sample rate: ${sampleRate} Hz`,
				);
			};

			// 注册监听器
			ffmpeg.on("log", sampleRateListener);

			try {
				// 执行 ffprobe 命令
				await ffmpeg.ffprobe.call(ffmpeg, args);
				return sampleRate;
			} finally {
				// 清理监听器
				ffmpeg.off("log", sampleRateListener);
			}
		} catch {
			// 检测失败返回 null
			return null;
		}
	}

	// 构建 FFmpeg 转换命令
	private async buildConversionCommand(
		ffmpeg: FFmpeg,
		input: VertFile,
		to: string,
		isAlac: boolean = false,
	): Promise<string[]> {
		// 获取输入和输出格式
		const inputFormat = input.from.slice(1);
		const outputFormat = to.slice(1);
		const m4a = isAlac || to === ".m4a";

		// 无损格式列表
		const lossless = [
			"flac",
			"m4a",
			"caf",
			"alac",
			"wav",
			"dsd",
			"dsf",
			"dff",
		];
		// 获取用户设置
		const userSetting = Settings.instance.settings.ffmpegQuality;
		const userSampleRate = Settings.instance.settings.ffmpegSampleRate;
		const customSampleRate =
			Settings.instance.settings.ffmpegCustomSampleRate ?? 44100;
		const keepMetadata = Settings.instance.settings.metadata;

		// 初始化命令参数
		let audioBitrateArgs: string[] = [];
		let sampleRateArgs: string[] = [];
		let metadataArgs: string[] = [];
		let m4aArgs: string[] = [];

		log(["converters", this.name], `keep metadata: ${keepMetadata}`);
		// 如果不保留元数据，添加移除元数据的参数
		if (!keepMetadata) {
			metadataArgs = [
				"-map_metadata", // 移除元数据
				"-1",
				"-map_chapters", // 移除章节
				"-1",
				"-map", // 移除封面
				"a",
			];
		}

		// 判断是否为无损到有损转换
		const isLosslessToLossy =
			lossless.includes(inputFormat) && !lossless.includes(outputFormat);
		if (userSetting !== "auto") {
			// 使用用户设置的比特率
			audioBitrateArgs = ["-b:a", `${userSetting}k`];
			log(
				["converters", this.name],
				`using user setting for audio bitrate: ${userSetting}`,
			);
		} else {
			// 自动检测输入文件的比特率
			if (isLosslessToLossy) {
				// 无损到有损转换，使用安全默认值
				audioBitrateArgs = ["-b:a", "128k"];
				log(
					["converters", this.name],
					`converting from lossless to lossy, using default audio bitrate: 128k`,
				);
			} else {
				// 检测输入文件的比特率
				const inputBitrate = await this.detectAudioBitrate(ffmpeg);
				audioBitrateArgs = inputBitrate
					? ["-b:a", `${inputBitrate}k`]
					: [];
				log(
					["converters", this.name],
					`using detected audio bitrate: ${inputBitrate}k`,
				);
			}
		}

		// 采样率设置
		if (userSampleRate !== "auto") {
			// 使用用户设置的采样率
			const rate =
				userSampleRate === "custom"
					? customSampleRate.toString()
					: userSampleRate;
			sampleRateArgs = ["-ar", rate];
			log(
				["converters", this.name],
				`using user setting for sample rate: ${rate}`,
			);
		} else {
			// 自动检测输入文件的采样率
			if (isLosslessToLossy) {
				// 无损到有损转换，使用安全默认值
				const defaultRate = to === ".opus" ? "48000" : "44100";
				log(
					["converters", this.name],
					`converting from lossless to lossy, using default sample rate: ${defaultRate}Hz`,
				);
				sampleRateArgs = ["-ar", defaultRate];
			} else {
				// 检测输入文件的采样率
				let inputSampleRate = await this.detectAudioSampleRate(ffmpeg);
				// 特殊情况：Opus 不支持 44100Hz，调整为 48000Hz
				if (to === ".opus" && inputSampleRate === 44100) {
					log(
						["converters", this.name],
						"conversion to opus with 44100Hz sample rate detected, adjusting to 48000Hz",
					);
					inputSampleRate = 48000;
				}

				sampleRateArgs = inputSampleRate
					? ["-ar", inputSampleRate.toString()]
					: [];
				log(
					["converters", this.name],
					`using detected audio sample rate: ${inputSampleRate}Hz`,
				);
			}
		}

		// 视频到音频转换
		if (videoFormats.includes(inputFormat) &&
			!videoFormats.includes(outputFormat)) {
			log(
				["converters", this.name],
				`Converting video ${input.from} to audio ${to}`,
			);
			return [
				"-i", "input", // 输入文件
				"-map", "0:a:0", // 映射第一个音频流
				...metadataArgs, // 元数据参数
				...audioBitrateArgs, // 比特率参数
				...sampleRateArgs, // 采样率参数
				"output" + to, // 输出文件
			];
		}
		// 视频到视频转换
		if (
			videoFormats.includes(inputFormat) &&
			videoFormats.includes(outputFormat)
		) {
			log(
				["converters", this.name],
				`Converting video ${input.from} to video ${to}`,
			);

			const codecArgs = toArgs(to, isAlac, false);

			return [
				"-i",
				"input",
				...codecArgs,
				...metadataArgs,
				...audioBitrateArgs,
				...sampleRateArgs,
				"output" + to,
			];
		}
		// 音频到视频转换
		if (videoFormats.includes(outputFormat)) {
			log(
				["converters", this.name],
				`Converting audio ${input.from} to video ${to}`,
			);

			// 尝试提取专辑封面
			const hasAlbumArt = keepMetadata
				? await this.extractAlbumArt(ffmpeg)
				: false;
			const codecArgs = toArgs(to, isAlac, true);

			if (hasAlbumArt) {
				// 使用专辑封面作为视频背景
				log(
					["converters", this.name],
					"Using album art as video background",
				);
				return [
					"-loop", "1", // 循环图片
					"-i", "cover.jpg", // 专辑封面
					"-i", "input", // 音频文件
					"-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", // 调整尺寸为偶数
					"-shortest", // 以最短的流为准
					"-pix_fmt", "yuv420p", // 像素格式
					"-r", "1", // 帧率 1 fps
					...codecArgs, // 编解码器参数
					...metadataArgs, // 元数据参数
					...audioBitrateArgs, // 比特率参数
					...sampleRateArgs, // 采样率参数
					"output" + to, // 输出文件
				];
			} else {
				// 使用纯色背景
				log(["converters", this.name], "Using solid color background");
				return [
					"-f", "lavfi", // 使用 lavfi 滤镜
					"-i", "color=c=black:s=512x512:rate=1", // 黑色背景 512x512 1fps
					"-i", "input", // 音频文件
					"-shortest", // 以最短的流为准
					"-pix_fmt", "yuv420p", // 像素格式
					"-r", "1", // 帧率 1 fps
					...toArgs(to, isAlac), // 编解码器参数
					...metadataArgs, // 元数据参数
					...audioBitrateArgs, // 比特率参数
					...sampleRateArgs, // 采样率参数
					"output" + to, // 输出文件
				];
			}
		}

		// 音频到音频转换
		log(
			["converters", this.name],
			`Converting audio ${input.from} to audio ${to}`,
		);
		const { audio: audioCodec } = getCodecs(to, isAlac);
		// 如果是 m4a 格式且保留元数据，保留视频流（专辑封面）
		if (m4a && keepMetadata) m4aArgs = ["-c:v", "copy"];

		return [
			"-i", "input", // 输入文件
			...m4aArgs, // m4a 特定参数
			"-c:a", audioCodec, // 音频编解码器
			...metadataArgs, // 元数据参数
			...audioBitrateArgs, // 比特率参数
			...sampleRateArgs, // 采样率参数
			"output" + to, // 输出文件
		];
	}

	// 提取专辑封面
	private async extractAlbumArt(ffmpeg: FFmpeg): Promise<boolean> {
		// 使用流映射提取（适用于大多数情况）
		if (
			await this.tryExtractAlbumArt(ffmpeg, [
				"-i", "input",
				"-map", "0:1", // 映射第二个流（通常是封面）
				"-c:v", "copy", // 直接复制视频流
				"-update", "1", // 更新文件
				"cover.jpg",
			])
		) {
			log(
				["converters", this.name],
				"Successfully extracted album art from stream 0:1",
			);
			return true;
		}

		// 回退方法：不使用流映射提取
		if (
			await this.tryExtractAlbumArt(ffmpeg, [
				"-i", "input",
				"-an", // 忽略音频
				"-c:v", "copy", // 直接复制视频流
				"-update", "1", // 更新文件
				"cover.jpg",
			])
		) {
			log(
				["converters", this.name],
				"Successfully extracted album art (fallback method)",
			);
			return true;
		}

		// 未找到专辑封面
		log(
			["converters", this.name],
			"No album art found, will create solid color background",
		);
		return false;
	}

	// 尝试提取专辑封面
	private async tryExtractAlbumArt(
		ffmpeg: FFmpeg,
		command: string[],
	): Promise<boolean> {
		try {
			// 执行提取命令
			await ffmpeg.exec(command);
			// 读取封面文件
			const coverData = await ffmpeg.readFile("cover.jpg");
			// 检查封面数据是否存在且不为空
			return !!(coverData && (coverData as Uint8Array).length > 0);
		} catch {
			// 提取失败返回 false
			return false;
		}
	}
}

// 开发者注释：
// 我以为完成 vertd 后就不再需要 ffmpeg 了
// 但是 OH NO，有人建议允许生成专辑封面视频
//
// 我太讨厌你了
// - love, maddie

// 根据文件扩展名生成编解码器参数
const toArgs = (ext: string, isAlac: boolean = false, isStaticImage: boolean = false): string[] => {
	const codecs = getCodecs(ext, isAlac);
	const args = ["-c:v", codecs.video];

	// 根据视频编解码器添加特定参数
	switch (codecs.video) {
		case "libx264": {
			args.push(
				"-preset",
				"ultrafast", // 最快编码预设
				"-crf",
				isStaticImage ? "18" : "23", // 恒定质量因子
			);

			if (isStaticImage) {
				args.push("-tune", "stillimage"); // 针对静态图像优化
			} else {
				// 针对普通视频，设置像素格式以确保兼容性
				args.push("-pix_fmt", "yuv420p");
			}
			break;
		}

		case "libvpx": {
			args.push("-c:v", "libvpx-vp9"); // 使用 VP9 编解码器
			break;
		}

		case "mpeg2video": {
			// 用于 mpeg, mpg, vob, mxf
			if (ext === ".mxf") args.push("-ar", "48000"); // 强制 48kHz 采样率
			break;
		}
	}

	// 添加音频编解码器
	args.push("-c:a", codecs.audio);

	// 如果是 AAC，添加实验性标志
	if (codecs.audio === "aac") args.push("-strict", "experimental");

	// 特殊格式处理
	if (ext === ".divx") args.unshift("-f", "avi"); // 强制使用 AVI 容器
	if (ext === ".mxf") args.push("-strict", "unofficial"); // 非官方格式

	return args;
};

// 根据文件扩展名获取编解码器
const getCodecs = (
	ext: string,
	isAlac: boolean = false,
): { video: string; audio: string } => {
	switch (ext) {
		// 视频 <-> 音频
		case ".mp4":
		case ".mkv":
		case ".mov":
		case ".mts":
		case ".ts":
		case ".m2ts":
		case ".flv":
		case ".f4v":
		case ".m4v":
		case ".3gp":
		case ".3g2":
			return { video: "libx264", audio: "aac" };
		case ".wmv":
			return { video: "wmv2", audio: "wmav2" };
		case ".webm":
		case ".ogv":
			return {
				video: ext === ".webm" ? "libvpx" : "libtheora",
				audio: "libvorbis",
			};
		case ".avi":
		case ".divx":
			return { video: "mpeg4", audio: "libmp3lame" };
		case ".mpg":
		case ".mpeg":
		case ".vob":
			return { video: "mpeg2video", audio: "mp2" };
		case ".mxf":
			return { video: "mpeg2video", audio: "pcm_s16le" };

		// 音频
		case ".mp3":
			return { video: "libx264", audio: "libmp3lame" };
		case ".flac":
			return { video: "libx264", audio: "flac" };
		case ".wav":
			return { video: "libx264", audio: "pcm_s16le" };
		case ".ogg":
		case ".oga":
			return { video: "libx264", audio: "libvorbis" };
		case ".opus":
			return { video: "libx264", audio: "libopus" };
		case ".aac":
			return { video: "libx264", audio: "aac" };
		case ".m4a":
			return {
				video: "libx264",
				audio: isAlac ? "alac" : "aac",
			};
		case ".alac":
			return { video: "libx264", audio: "alac" };
		case ".wma":
			return { video: "libx264", audio: "wmav2" };

		// 默认编解码器
		default:
			return { video: "libx264", audio: "aac" };
	}
};

// 支持的转换比特率列表
export const CONVERSION_BITRATES = [
	"auto", // 自动检测
	320, // 320 kbps
	256, // 256 kbps
	192, // 192 kbps
	128, // 128 kbps
	96, // 96 kbps
	64, // 64 kbps
	32, // 32 kbps
] as const;
export type ConversionBitrate = (typeof CONVERSION_BITRATES)[number];

// 支持的采样率列表
export const SAMPLE_RATES = [
	"auto", // 自动检测
	"custom", // 自定义
	"48000", // 48000 Hz
	"44100", // 44100 Hz
	"32000", // 32000 Hz
	"22050", // 22050 Hz
	"16000", // 16000 Hz
	"11025", // 11025 Hz
	"8000", // 8000 Hz
] as const;
export type SampleRate = (typeof SAMPLE_RATES)[number];
