/**
 * MagickConverter 类 - 图片格式转换实现
 * 
 * 功能概述：
 * - 使用 ImageMagick WebAssembly 实现纯前端图片格式转换
 * - 支持多种图片格式之间的相互转换
 * - 使用 Worker 线程处理转换任务，避免阻塞主线程
 * - 提供 SVG 特殊处理逻辑
 * - 支持压缩质量设置
 * 
 * 核心依赖：
 * - @imagemagick/magick-wasm: WebAssembly 版本的 ImageMagick
 * - Web Workers: 多线程处理
 * - Svelte 5: 响应式状态管理
 */
import { browser } from "$app/environment";
import { error, log } from "$lib/util/logger";
import { m } from "$lib/paraglide/messages";
import { VertFile, type WorkerMessage } from "$lib/types";
import MagickWorker from "$lib/workers/magick?worker&url";
import { Converter, FormatInfo } from "./converter.svelte";
import { imageFormats } from "./magick-automated";
import { Settings } from "$lib/sections/settings/index.svelte";
import magickWasm from "@imagemagick/magick-wasm/magick.wasm?url";
import { ToastManager } from "$lib/util/toast.svelte";

export class MagickConverter extends Converter {
	/** 转换器名称 */
	public name = "imagemagick";
	
	/** 转换器就绪状态 */
	public ready = $state(false);
	
	/** ImageMagick WebAssembly 模块 */
	public wasm: ArrayBuffer = null!;

	/** 活跃转换任务映射，用于跟踪正在进行的转换 */
	private activeConversions = new Map<string, Worker>();

	/**
	 * 支持的图片格式列表
	 * 
	 * 格式说明：
	 * - 第一个参数：格式名称
	 * - 第二个参数：是否支持输入
	 * - 第三个参数：是否支持输出
	 */
	public supportedFormats = [
		// 手动测试的格式
		new FormatInfo("png", true, true),
		new FormatInfo("jpeg", true, true),
		new FormatInfo("jpg", true, true),
		new FormatInfo("webp", true, true),
		new FormatInfo("gif", true, true),
		new FormatInfo("svg", true, true),
		new FormatInfo("jxl", true, true),
		new FormatInfo("avif", true, true),
		new FormatInfo("heic", true, false), // 似乎不太可靠？HEIC/HEIF 支持不稳定
		new FormatInfo("heif", true, false),
		// TODO: .ico 文件可以编码多个不同大小、位深度的图像，未来应该支持
		new FormatInfo("ico", true, true),
		new FormatInfo("bmp", true, true),
		new FormatInfo("cur", true, true),
		new FormatInfo("ani", true, false),
		new FormatInfo("icns", true, false),
		new FormatInfo("nef", true, false),
		new FormatInfo("cr2", true, false),
		new FormatInfo("hdr", true, true),
		new FormatInfo("jpe", true, true),
		new FormatInfo("mat", true, true),
		new FormatInfo("pbm", true, true),
		new FormatInfo("pfm", true, true),
		new FormatInfo("pgm", true, true),
		new FormatInfo("pnm", true, true),
		new FormatInfo("ppm", true, true),
		new FormatInfo("tiff", true, true),
		new FormatInfo("jfif", true, true),
		new FormatInfo("eps", false, true),
		new FormatInfo("psd", true, true),

		// 相机原始格式
		new FormatInfo("arw", true, false),
		new FormatInfo("tif", true, true),
		new FormatInfo("dng", true, false),
		new FormatInfo("xcf", true, false),
		new FormatInfo("rw2", true, false),
		new FormatInfo("raf", true, false),
		new FormatInfo("orf", true, false),
		new FormatInfo("pef", true, false),
		new FormatInfo("mos", true, false),
		new FormatInfo("raw", true, false),
		new FormatInfo("dcr", true, false),
		new FormatInfo("crw", true, false),
		new FormatInfo("cr3", true, false),
		new FormatInfo("3fr", true, false),
		new FormatInfo("erf", true, false),
		new FormatInfo("mrw", true, false),
		new FormatInfo("mef", true, false),
		new FormatInfo("nrw", true, false),
		new FormatInfo("srw", true, false),
		new FormatInfo("sr2", true, false),
		new FormatInfo("srf", true, false),

		// 从自动化测试添加的格式
		...imageFormats,
	];

	/** 是否报告转换进度 */
	public readonly reportsProgress = false;

	/**
	 * 构造函数
	 * 
	 * 初始化转换器并加载 WebAssembly 模块
	 */
	constructor() {
		super();
		log(["converters", this.name], `created converter`);
		if (!browser) return;
		this.initializeWasm();
	}

	/**
	 * 初始化 WebAssembly 模块
	 * 
	 * 执行流程：
	 * 1. 设置状态为 "downloading"
	 * 2. 从 CDN 下载 ImageMagick WebAssembly 文件
	 * 3. 将响应转换为 ArrayBuffer
	 * 4. 设置状态为 "ready"
	 * 5. 处理下载错误
	 */
	private async initializeWasm() {
		try {
			this.status = "downloading";
			const response = await fetch(magickWasm);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch WASM: ${response.status} ${response.statusText}`,
				);
			}

			this.wasm = await response.arrayBuffer();
			this.status = "ready";
		} catch (err) {
			this.status = "error";
			error(
				["converters", this.name],
				`Failed to load ImageMagick WASM: ${err}`,
			);

			ToastManager.add({
				type: "error",
				message: m["workers.errors.magick"](),
			});
		}
	}

	/**
	 * 执行图片格式转换
	 * 
	 * @param input - 输入文件对象
	 * @param to - 目标格式
	 * @param args - 额外参数，第一个参数为压缩质量
	 * @returns 转换后的文件对象
	 */
	public async convert(
		input: VertFile,
		to: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		...args: any[]
	): Promise<VertFile> {
		/** 压缩质量设置 */
		let compression: number | undefined = args.at(0);
		if (!compression) {
			compression = Settings.instance.settings.magickQuality ?? 100;
			log(
				["converters", this.name],
				`using user setting for quality: ${compression}%`,
			);
		}
		log(["converters", this.name], `converting ${input.name} to ${to}`);

		// 手动处理 SVG 转换，因为 magick-wasm 不支持
		if (input.from === ".svg") {
			try {
				const blob = await this.svgToImage(input);
				const pngFile = new VertFile(
					new File([blob], input.name.replace(/\.svg$/i, ".png")),
					input.to,
				);
				if (to === ".png") return pngFile; // 如果目标是 png，直接返回
				return await this.convert(pngFile, to, ...args); // 否则，递归将 png 转换为用户目标格式
			} catch (err) {
				error(
					["converters", this.name],
					`SVG conversion failed: ${err}`,
				);
				throw err;
			}
		}

		/** 创建新的 Worker 实例处理转换任务 */
		const worker = new Worker(MagickWorker, {
			type: "module",
		});
		this.activeConversions.set(input.id, worker);

		try {
			/** 等待 Worker 就绪，设置 10 秒超时 */
			await Promise.race([
				this.waitForMessage(worker, "ready"),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error(
									"Magick worker ready timeout after 10 seconds",
								),
						),
						10000,
					),
				),
			]);

			/** 发送加载 WASM 的消息 */
			const loadMsg: WorkerMessage = {
				type: "load",
				wasm: this.wasm,
				id: input.id,
			};
			worker.postMessage(loadMsg);

			/** 等待 WASM 加载完成，设置 30 秒超时 */
			await Promise.race([
				this.waitForMessage(worker, "loaded"),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error(
									"Magick worker initialization timeout after 30 seconds",
								),
						),
						30000,
					),
				),
			]);

			/** 处理其他格式的转换 */
			const keepMetadata: boolean =
				Settings.instance.settings.metadata ?? true;
			log(["converters", this.name], `keep metadata: ${keepMetadata}`);
			
			/** 发送转换消息 */
			const convertMsg: WorkerMessage = {
				type: "convert",
				id: input.id,
				input: {
					file: input.file,
					name: input.name,
					from: input.from,
					to: input.to,
				},
				to,
				compression,
				keepMetadata,
			};
			worker.postMessage(convertMsg);

			/** 等待转换结果 */
			const res = await this.waitForMessage(worker);
			if (res.type === "finished") {
				log(
					["converters", this.name],
					`converted ${input.name} to ${to}`,
				);
				return new VertFile(
					new File([res.output as unknown as BlobPart], input.name),
					res.zip ? ".zip" : to,
				);
			}

			if (res.type === "error") {
				throw new Error(res.error);
			}

			throw new Error("Unknown message type");
		} finally {
			/** 清理资源 */
			this.activeConversions.delete(input.id);
			worker.terminate();
		}
	}

	/**
	 * 取消正在进行的转换
	 * 
	 * @param input - 要取消的文件对象
	 */
	public async cancel(input: VertFile): Promise<void> {
		const worker = this.activeConversions.get(input.id);
		if (!worker) {
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

		/** 终止 Worker 并清理映射 */
		worker.terminate();
		this.activeConversions.delete(input.id);
	}

	/**
	 * 等待 Worker 消息
	 * 
	 * @param worker - Worker 实例
	 * @param type - 消息类型（可选）
	 * @returns 消息数据
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private waitForMessage(worker: Worker, type?: string): Promise<any> {
		return new Promise((resolve, reject) => {
			const onMessage = (e: MessageEvent) => {
				if (type && e.data.type === type) {
					worker.removeEventListener("message", onMessage);
					worker.removeEventListener("error", onError);
					resolve(e.data);
				} else if (!type) {
					worker.removeEventListener("message", onMessage);
					worker.removeEventListener("error", onError);
					resolve(e.data);
				} else if (e.data.type === "error") {
					worker.removeEventListener("message", onMessage);
					worker.removeEventListener("error", onError);
					reject(new Error(e.data.error));
				}
			};

			const onError = (e: ErrorEvent) => {
				worker.removeEventListener("message", onMessage);
				worker.removeEventListener("error", onError);
				reject(new Error(`Worker error: ${e.message}`));
			};

			worker.addEventListener("message", onMessage);
			worker.addEventListener("error", onError);
		});
	}

	/**
	 * 将 SVG 转换为图片
	 * 
	 * 实现原理：
	 * 1. 读取 SVG 文本内容
	 * 2. 创建 SVG Blob 和 URL
	 * 3. 使用 Canvas 绘制 SVG
	 * 4. 将 Canvas 转换为 PNG Blob
	 * 
	 * @param input - 输入的 SVG 文件
	 * @returns 转换后的 PNG Blob
	 */
	private async svgToImage(input: VertFile): Promise<Blob> {
		log(["converters", this.name], `converting SVG to image (PNG)`);

		const svgText = await input.file.text();
		const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
		const svgUrl = URL.createObjectURL(svgBlob);

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get canvas context");

		const img = new Image();

		/** 尝试从 SVG 提取尺寸，失败则使用默认值 */
		let width = 512;
		let height = 512;
		const widthMatch = svgText.match(/width=["'](\d+)["']/);
		const heightMatch = svgText.match(/height=["'](\d+)["']/);
		const viewBoxMatch = svgText.match(
			/viewBox=["'][^"']*\s+(\d+)\s+(\d+)["']/,
		);

		if (widthMatch && heightMatch) {
			width = parseInt(widthMatch[1]);
			height = parseInt(heightMatch[1]);
		} else if (viewBoxMatch) {
			width = parseInt(viewBoxMatch[1]);
			height = parseInt(viewBoxMatch[2]);
		}

		return new Promise((resolve, reject) => {
			img.onload = () => {
				try {
					canvas.width = img.naturalWidth || width;
					canvas.height = img.naturalHeight || height;

					ctx.drawImage(img, 0, 0);

					canvas.toBlob((blob) => {
						URL.revokeObjectURL(svgUrl);
						if (blob) {
							resolve(blob);
						} else {
							reject(
								new Error("Failed to convert canvas to Blob"),
						);
						}
					}, "image/png");
				} catch (err) {
					URL.revokeObjectURL(svgUrl);
					reject(err);
				}
			};

			img.onerror = () => {
				URL.revokeObjectURL(svgUrl);
				reject(new Error("Failed to load SVG image"));
			};

			img.src = svgUrl;
		});
	}
}
