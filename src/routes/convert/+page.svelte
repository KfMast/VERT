<script lang="ts">
	/**
	 * 转换页面组件
	 *
	 * 功能概述:
	 * - 展示已上传的文件列表
	 * - 支持单个/批量文件格式转换
	 * - 显示转换进度和预览
	 * - 提供格式选择和下载功能
	 *
	 * 核心数据流:
	 * 1. 用户上传文件 -> files store 管理文件队列
	 * 2. 自动识别文件类型并分配转换器
	 * 3. 根据设置自动选择目标格式
	 * 4. 用户选择格式并触发转换
	 * 5. 显示进度、结果和下载选项
	 */

	// ========== 组件导入 ==========

	// 功能组件 - 提供核心业务功能
	import ConversionPanel from "$lib/components/functional/ConversionPanel.svelte";
	import FormatDropdown from "$lib/components/functional/FormatDropdown.svelte";
	import Uploader from "$lib/components/functional/Uploader.svelte";

	// 视觉组件 - 提供 UI 展示元素
	import Panel from "$lib/components/visual/Panel.svelte";
	import ProgressBar from "$lib/components/visual/ProgressBar.svelte";
	import Tooltip from "$lib/components/visual/Tooltip.svelte";

	// 转换器模块 - 格式转换逻辑
	import { categories, converters } from "$lib/converters";

	// 状态管理 - 全局状态访问
	import {
		effects, // 动画效果开关状态
		files, // 文件队列管理
		gradientColor, // 背景渐变颜色
		showGradient, // 是否显示背景渐变
		vertdLoaded, // Vertd 服务器连接状态
		dropdownStates, // 下拉菜单状态（保存用户选择的格式）
	} from "$lib/store/index.svelte";

	// 类型定义
	import { VertFile } from "$lib/types";
	import { Settings } from "$lib/sections/settings/index.svelte";
	import { MAX_ARRAY_BUFFER_SIZE } from "$lib/store/index.svelte";
	import { GB } from "$lib/util/consts";
	import { log } from "$lib/util/logger";

	// 图标组件 - 文件类型视觉标识
	import {
		AudioLines, // 音频图标
		BookText, // 文档图标
		DownloadIcon, // 下载图标
		FileMusicIcon, // 音乐文件图标
		FileQuestionIcon, // 未知文件图标
		FileVideo2, // 视频文件图标
		FilmIcon, // 视频图标
		ImageIcon, // 图像图标
		ImageOffIcon, // 无图像占位图标
		RotateCwIcon, // 转换图标
		XIcon, // 关闭/删除图标
	} from "lucide-svelte";

	// 国际化消息
	import { m } from "$lib/paraglide/messages";

	// ========== 响应式状态定义 ==========

	/**
	 * 已处理文件 ID 集合
	 *
	 * 用途: 防止重复处理同一文件
	 * 触发时机: 在 format 初始化 effect 中使用
	 * 工作原理:
	 * - 当用户导航回此页面时，effect 会重新运行
	 * - 已处理的文件会被记录在此集合中
	 * - 下次运行时跳过这些文件，避免重复设置格式
	 */
	let processedFileIds = $state(new Set<string>());

	// ========== 副作用: 初始化文件格式设置 ==========

	/**
	 * 自动设置目标格式逻辑
	 *
	 * 执行流程:
	 * 1. 检查 Settings 是否加载且文件队列非空
	 * 2. 遍历每个未处理的 file
	 * 3. 查找该文件对应的转换器
	 * 4. 确定文件类别 (image/audio/video/doc)
	 * 5. 按优先级选择目标格式:
	 *    a. 恢复用户上次选择的格式 (从 dropdownStates 读取)
	 *    b. 使用默认格式 (如果启用了 useDefaultFormat)
	 *    c. 选择第一个不同于输入格式的可用格式
	 * 6. 将文件标记为已处理
	 */
	$effect(() => {
		// 1. 条件检查 - Settings 未加载或无文件时直接返回
		if (!Settings.instance.settings || files.files.length === 0) return;

		// 2. 遍历文件队列
		files.files.forEach((file) => {
			const settings = Settings.instance.settings;

			// 3. 跳过已处理的文件
			if (processedFileIds.has(file.id)) return;

			// 4. 查找转换器
			const converter = file.findConverter();
			if (!converter) return;

			// 5. 确定文件类别
			let category: string | undefined;
			const isImage = converter.name === "imagemagick";
			const isAudio = converter.name === "ffmpeg";
			const isVideo = converter.name === "vertd";
			const isDocument = converter.name === "pandoc";

			// 根据转换器名称映射到类别
			if (isImage) category = "image";
			else if (isAudio) category = "audio";
			else if (isVideo) category = "video";
			else if (isDocument) category = "doc";
			if (!category) return;

			// 6. 格式选择逻辑
			let targetFormat: string | undefined;

			// 优先级 a: 恢复用户上次选择的格式
			// 使用场景: 用户从其他页面导航回来时，保持之前的选择
			const savedFormat = $dropdownStates[file.name];
			if (
				savedFormat &&
				savedFormat !== file.from &&
				categories[category]?.formats.includes(savedFormat)
			) {
				targetFormat = savedFormat;
			}
			// 优先级 b: 使用默认格式
			else if (settings.useDefaultFormat) {
				let defaultFormat: string | undefined;
				const df = settings.defaultFormat;

				// 根据类别获取对应的默认格式
				if (category === "image") defaultFormat = df.image;
				else if (category === "audio") defaultFormat = df.audio;
				else if (category === "video") defaultFormat = df.video;
				else if (category === "doc") defaultFormat = df.document;

				// 验证默认格式的有效性
				if (
					defaultFormat &&
					defaultFormat !== file.from &&
					categories[category]?.formats.includes(defaultFormat)
				) {
					targetFormat = defaultFormat;
				}
			}

			// 优先级 c: 选择第一个不同的可用格式
			// 如果默认格式就是输入格式本身，则选择列表中第一个其他格式
			if (!targetFormat) {
				const firstDiff = categories[category]?.formats.find(
					(f) => f !== file.from,
				);
				targetFormat =
					firstDiff || categories[category]?.formats[0] || "";
			}

			// 7. 应用目标格式并标记为已处理
			file.to = targetFormat;
			processedFileIds.add(file.id);
		});
	});

	/**
	 * 处理格式选择变化
	 *
	 * @param option - 选择的格式
	 * @param file - 目标文件
	 *
	 * 作用: 当用户选择不同格式时，清除之前的转换结果
	 * 原因: 用户选择新格式后，需要重新转换，原结果不再适用
	 */
	const handleSelect = (option: string, file: VertFile) => {
		file.result = null;
	};

	// ========== 副作用: 更新背景渐变颜色 ==========

	/**
	 * 格式化文件大小
	 * @param bytes - 文件字节数
	 */
	const formatSize = (bytes: number) => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB", "TB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	/**
	 * 动态背景渐变颜色控制
	 *
	 * 设计理念: 根据文件类型显示不同颜色的渐变背景
	 * - 图像 (imagemagick): 蓝色系
	 * - 音频 (ffmpeg): 紫色系
	 * - 视频 (vertd): 红色系
	 * - 文档 (pandoc): 绿色系
	 *
	 * 触发条件: 只有当所有文件属于同一类型时才显示渐变
	 * 混合类型时不显示，避免视觉混乱
	 */
	$effect(() => {
		let type = "";

		// 文件队列非空时进行分析
		if (files.files.length) {
			// 收集所有文件的转换器类型
			const converters = files.files.map(
				(file) => file.findConverter()?.name,
			);
			const uniqueTypes = new Set(converters);

			// 只有当所有文件类型一致时才设置渐变色
			if (uniqueTypes.size === 1) {
				const onlyType = converters[0];
				if (onlyType === "imagemagick") type = "blue";
				else if (onlyType === "ffmpeg") type = "purple";
				else if (onlyType === "vertd") type = "red";
				else if (onlyType === "pandoc") type = "green";
			}
		}

		// 无文件或混合类型时隐藏渐变
		if (files.files.length === 0 || !type) {
			showGradient.set(false);
		} else showGradient.set(true);

		// 设置渐变颜色，Layout 组件会根据此值渲染对应渐变
		gradientColor.set(type);
	});
</script>

<!-- 单个文件项展示片段
     功能: 显示文件类型图标、文件名/进度、预览图、格式选择和操作按钮 -->
{#snippet fileItem(file: VertFile, index: number)}
	{@const currentConverter = file.findConverter()}
	{@const isImage = currentConverter?.name === "imagemagick"}
	{@const isAudio = currentConverter?.name === "ffmpeg"}
	{@const isVideo = currentConverter?.name === "vertd"}
	{@const isDocument = currentConverter?.name === "pandoc"}

	<Panel class="p-5 flex flex-col min-w-0 gap-4 relative">
		<!-- 顶部区域: 文件类型图标 + 文件名/进度 + 删除按钮 -->
		<div class="flex-shrink-0 h-8 w-full flex items-center gap-2">
			<!-- 文件类型图标显示：根据当前转换器类型显示不同图标 -->
			{#if !converters.length}
				<!-- 边界情况: 无可用转换器 -->
				<Tooltip
					text={m["convert.tooltips.unknown_file"]()}
					position="bottom"
				>
					<FileQuestionIcon size="24" class="flex-shrink-0" />
				</Tooltip>
			{:else if isAudio}
				<Tooltip
					text={m["convert.tooltips.audio_file"]()}
					position="bottom"
				>
					<AudioLines size="24" class="flex-shrink-0" />
				</Tooltip>
			{:else if isVideo}
				<Tooltip
					text={m["convert.tooltips.video_file"]()}
					position="bottom"
				>
					<FilmIcon size="24" class="flex-shrink-0" />
				</Tooltip>
			{:else if isDocument}
				<Tooltip
					text={m["convert.tooltips.document_file"]()}
					position="bottom"
				>
					<BookText size="24" class="flex-shrink-0" />
				</Tooltip>
			{:else}
				<Tooltip
					text={m["convert.tooltips.image_file"]()}
					position="bottom"
				>
					<ImageIcon size="24" class="flex-shrink-0" />
				</Tooltip>
			{/if}

			<!-- 文件名或进度条显示区域 -->
			<div class="flex-grow overflow-hidden">
				{#if file.processing}
					<!-- 转换中状态 -->
					<ProgressBar
						min={0}
						max={100}
						progress={currentConverter?.reportsProgress ||
						file.isZip()
							? file.progress
							: null}
					/>
				{:else}
					<!-- 空闲状态 -->
					<div class="flex items-center gap-2 w-full min-w-0">
						<h2
							class="text-xl font-body overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0"
							title={file.name}
						>
							{file.name}
						</h2>
						<span
							class="text-sm text-muted-foreground whitespace-nowrap flex-shrink-0"
						>
							{formatSize(file.file.size)}
						</span>
					</div>
				{/if}
			</div>

			<!-- 删除文件按钮 -->
			<button
				class="flex-shrink-0 w-8 rounded-full hover:bg-panel-alt h-full flex items-center justify-center"
				onclick={async () => {
					await file.cancel();
					files.files = files.files.filter((_, i) => i !== index);
				}}
			>
				<XIcon size="24" class="text-muted" />
			</button>
		</div>

		<!-- 中间区域: 根据状态显示不同内容 -->
		{#if !currentConverter}
			<!-- 状态 1: 无可用转换器 -->
			{#if file.name.startsWith("vertd")}
				<!-- Vertd 服务器相关错误 -->
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.vertd_server"]()}
					</p>
				</div>
			{:else}
				<!-- 格式不支持错误 -->
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.unsupported_format"]()}
					</p>
				</div>
			{/if}
		{:else}
			<!-- 获取格式信息和文件大小状态 -->
			{@const formatInfo = currentConverter.supportedFormats.find(
				(f) => f.name === file.from,
			)}
			{@const isLarge = file.isLarge()}

			{#if formatInfo && !formatInfo.fromSupported}
				<!-- 状态 2: 格式仅支持输出 -->
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.format_output_only"]()}
					</p>
				</div>
			{:else if isLarge && !file.supportsStreaming()}
				<!-- 状态 3: 文件过大 -->
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["workers.errors.file_too_large"]({
							limit: (MAX_ARRAY_BUFFER_SIZE / GB).toFixed(2),
						})}
					</p>
				</div>
			{:else if currentConverter.status === "downloading"}
				<!-- 状态 4a: 转换器正在下载 WASM -->
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.worker_downloading"]({
							type: isAudio
								? m["convert.errors.audio"]()
								: isVideo
									? "Video"
									: isDocument
										? m["convert.errors.doc"]()
										: m["convert.errors.image"](),
						})}
					</p>
				</div>
			{:else if currentConverter.status === "error"}
				<!-- 状态 4b: 转换器加载错误 -->
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.worker_error"]({
							type: isAudio
								? m["convert.errors.audio"]()
								: isVideo
									? "Video"
									: isDocument
										? m["convert.errors.doc"]()
										: m["convert.errors.image"](),
						})}
					</p>
				</div>
			{:else if currentConverter.status === "not-ready"}
				<!-- 状态 4c: 转换器超时未就绪 -->
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.worker_timeout"]({
							type: isAudio
								? m["convert.errors.audio"]()
								: isVideo
									? "Video"
									: isDocument
										? m["convert.errors.doc"]()
										: m["convert.errors.image"](),
						})}
					</p>
				</div>
			{:else if isVideo && !$vertdLoaded && !isAudio && !isImage && !isDocument}
				<!-- 状态 5: 视频转换器未连接 -->
				<div
					class="h-full flex flex-col text-center justify-center text-failure"
				>
					<p class="font-body font-bold">
						{m["convert.errors.cant_convert"]()}
					</p>
					<p class="font-normal">
						{m["convert.errors.vertd_not_found"]()}
					</p>
				</div>
			{:else}
				<!-- 状态 6: 正常显示转换界面 -->
				<div class="flex flex-row justify-between">
					<!-- 左侧: 预览区域 -->
					<div
						class="flex gap-4 w-full h-[152px] overflow-hidden relative"
					>
						<div class="w-1/2 h-full overflow-hidden rounded-xl">
							{#if file.blobUrl}
								<!-- 有缩略图时显示 -->
								<img
									class="object-cover w-full h-full"
									src={file.blobUrl}
									alt={file.name}
								/>
							{:else}
								<!-- 无缩略图时显示占位 -->
								<div
									class="w-full h-full flex items-center justify-center text-black"
									style="background: var({isAudio
										? '--bg-gradient-purple-alt'
										: isVideo
											? '--bg-gradient-red-alt'
											: isDocument
												? '--bg-gradient-green-alt'
												: '--bg-gradient-blue-alt'})"
								>
									{#if isAudio}
										<FileMusicIcon size="56" />
									{:else if isVideo}
										<FileVideo2 size="56" />
									{:else if isDocument}
										<BookText size="56" />
									{:else}
										<ImageOffIcon size="56" />
									{/if}
								</div>
							{/if}
						</div>
					</div>
					<!-- 右侧: 操作区域 -->
					<div
						class="absolute top-16 right-0 mr-4 pl-2 h-[calc(100%-83px)] w-[calc(50%-38px)] pr-4 pb-1 flex items-center justify-center aspect-square"
					>
						<div
							class="w-[122px] h-fit flex flex-col gap-2 items-center justify-center"
						>
							<!-- 格式选择下拉框 -->
							<FormatDropdown
								{categories}
								from={file.from}
								bind:selected={file.to}
								onselect={(option) =>
									handleSelect(option, file)}
								{file}
							/>
							<!-- 操作按钮组 -->
							<div
								class="w-full flex items-center justify-between"
							>
								<!-- 转换按钮 -->
								<Tooltip
									text={m["convert.tooltips.convert_file"]()}
									position="bottom"
								>
									<button
										class="btn {$effects
											? ''
											: '!scale-100'} p-0 w-14 h-14 text-white {isAudio
											? 'bg-accent-purple'
											: isVideo
												? 'bg-accent-red'
												: isDocument
													? 'bg-accent-green'
													: 'bg-accent-blue'}"
										disabled={!files.ready}
										onclick={() => file.convert()}
									>
										<RotateCwIcon size="24" />
									</button>
								</Tooltip>
								<!-- 下载按钮 -->
								<Tooltip
									text={m["convert.tooltips.download_file"]()}
									position="bottom"
								>
									<button
										class="btn {$effects
											? ''
											: '!scale-100'} p-0 w-14 h-14"
										onclick={file.download}
										disabled={!file.result}
									>
										<DownloadIcon size="24" />
									</button>
								</Tooltip>
							</div>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</Panel>
{/snippet}

<!-- 页面主容器 -->
<div class="flex flex-col justify-center items-center gap-8 px-4 md:p-0">
	<!-- 顶部: 批量操作面板 -->
	<div class="max-w-[778px] w-full">
		<ConversionPanel />
	</div>

	<!-- 文件网格区域 -->
	<div
		class="w-full max-w-[778px] grid grid-cols-1 md:grid-cols-2 auto-rows-[240px] gap-4 md:p-0"
	>
		<!-- 文件列表渲染 -->
		{#each files.files as file, i (file.id)}
			<!-- 条件 1: 多文件时在第二位置显示上传组件 -->
			{#if files.files.length >= 2 && i === 1}
				<Uploader
					class="w-full h-full col-start-1 row-start-1 md:col-start-2"
				/>
			{/if}

			<!-- 渲染文件项 -->
			{@render fileItem(file, i)}

			<!-- 条件 2: 少文件时在末尾显示上传组件 -->
			{#if files.files.length < 2}
				<Uploader class="w-full h-full" />
			{/if}
		{/each}

		<!-- 条件 3: 无文件时上传组件占满整行 -->
		{#if files.files.length === 0}
			<Uploader class="w-full h-full col-span-2" />
		{/if}
	</div>
</div>
