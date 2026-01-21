<script lang="ts">
	/**
	 * Uploader 上传组件
	 * 
	 * 功能概述:
	 * - 提供文件选择界面
	 * - 支持点击上传和拖拽上传（禁用默认行为）
	 * - 自动将选择的文件添加到 files store
	 * - 新文件添加后自动跳转到转换页面
	 * 
	 * 使用方式:
	 * - 支持 multiple 属性，可选择多个文件
	 * - 通过 class 属性接受外部样式类
	 * - 内部使用 hidden input 元素触发文件选择
	 * 
	 * 依赖:
	 * - files store: 管理已上传文件队列
	 * - converters: 格式转换器（用于确定文件类型）
	 * - goto: 页面导航函数
	 */
	
	// ========== 组件导入 ==========
	
	// 图标组件 - 上传按钮显示的上传图标
	import { UploadIcon } from "lucide-svelte";
	
	// 视觉组件 - 面板容器，提供卡片式外观
	import Panel from "../visual/Panel.svelte";
	
	// 工具函数 - CSS 类名拼接库
	import clsx from "clsx";
	
	// Svelte 生命周期 - 组件挂载时添加事件监听器
	import { onMount } from "svelte";
	
	// 状态管理 - 全局状态访问
	import { effects, files } from "$lib/store/index.svelte";
	
	// 转换器模块 - 用于识别文件类型（虽然本组件未直接使用，但确保转换器加载）
	import { converters } from "$lib/converters";
	
	// 页面导航 - 编程式导航到指定页面
	import { goto } from "$app/navigation";
	
	// SvelteKit 页面状态 - 获取当前页面信息（如 URL 参数等）
	import { page } from "$app/state";
	
	// 国际化消息 - 获取本地化文本
	import { m } from "$lib/paraglide/messages";
	
	// ========== Props 类型定义 ==========
	
	/**
	 * 组件属性接口
	 * 
	 * @property class - 外部传入的 CSS 类名，用于自定义样式
	 */
	type Props = {
		class?: string;
	};
	
	// 解构 Props，获取 classList 参数
	const { class: classList }: Props = $props();
	
	// ========== 响应式状态 ==========
	
	/**
	 * 上传按钮元素引用
	 * 
	 * 用途: 用于绑定拖拽事件监听器
	 * 类型: HTMLButtonElement
	 */
	let uploaderButton = $state<HTMLButtonElement>();
	
	/**
	 * 隐藏的文件输入元素引用
	 * 
	 * 用途: 触发系统文件选择对话框
	 * 类型: HTMLInputElement
	 * 特点: 实际使用时不直接显示，通过 click() 方法触发
	 */
	let fileInput = $state<HTMLInputElement>();
	
	// ========== 事件处理函数 ==========
	
	/**
	 * 触发文件选择对话框
	 * 
	 * 工作原理:
	 * - 隐藏的 fileInput 元素通过 click() 方法打开系统文件选择器
	 * - 用户选择文件后触发 onchange 事件
	 * 
	 * 使用场景:
	 * - 点击上传按钮时调用
	 */
	const uploadFiles = async () => {
		if (!fileInput) return;
		fileInput.click();
	};
	
	/**
	 * 处理文件选择变化
	 * 
	 * 触发时机: 用户选择文件后（通过点击或拖拽）
	 * 
	 * 执行流程:
	 * 1. 记录添加文件前的队列长度
	 * 2. 调用 files.add() 将选择的文件添加到队列
	 * 3. 检查是否有新文件被添加
	 * 4. 如有新文件，自动导航到转换页面
	 * 
	 * @param e - 原生事件对象（Event）
	 */
	const handleFileChange = (e: Event) => {
		if (!fileInput) return;
		
		// 记录添加前的文件数量
		const oldLength = files.files.length;
		
		// 将选择的文件添加到队列
		// files.add() 内部会处理单个文件、文件数组、FileList 等多种情况
		files.add(fileInput.files);
		
		// 只有当确实添加了新文件时才跳转
		// 避免用户取消选择后又跳转到转换页面
		if (oldLength !== files.files.length) {
			goto("/convert");
		}
	};
	
	// ========== 生命周期 ==========
	
	/**
	 * 组件挂载初始化
	 * 
	 * 执行操作:
	 * - 添加拖拽相关的事件监听器到按钮元素
	 * - 禁用默认的拖拽行为（阻止浏览器打开文件）
	 * 
	 * 事件监听列表:
	 * - dragover: 拖拽元素在目标区域上方时触发
	 * - dragenter: 拖拽元素进入目标区域时触发
	 * - dragleave: 拖拽元素离开目标区域时触发
	 * - drop: 拖拽元素释放时触发
	 * 
	 * 清理函数:
	 * - 组件卸载时移除所有事件监听器
	 * - 防止内存泄漏
	 */
	onMount(() => {
		/**
		 * 拖拽事件处理器
		 * 
		 * 功能: 阻止元素的默认拖拽行为
		 * 
		 * 原因:
		 * - 浏览器默认会将拖拽的文件直接打开
		 * - 我们需要通过 JavaScript 处理文件而不是让浏览器直接打开
		 * 
		 * @param e - 拖拽事件对象
		 */
		const handler = (e: Event) => {
			e.preventDefault();
			return false;
		};
		
		// 添加事件监听器
		// 可选链操作符 (?.) 确保元素存在时才添加监听器
		uploaderButton?.addEventListener("dragover", handler);
		uploaderButton?.addEventListener("dragenter", handler);
		uploaderButton?.addEventListener("dragleave", handler);
		uploaderButton?.addEventListener("drop", handler);
		
		// 返回清理函数（组件卸载时执行）
		return () => {
			uploaderButton?.removeEventListener("dragover", handler);
			uploaderButton?.removeEventListener("dragenter", handler);
			uploaderButton?.removeEventListener("dragleave", handler);
			uploaderButton?.removeEventListener("drop", handler);
		};
	});
</script>

<!-- /**
 * 隐藏的文件输入元素
 * 
 * 特点:
 * - type="file": 触发系统文件选择器
 * - multiple: 允许选择多个文件
 * - class="hidden": 视觉隐藏但仍可被脚本访问
 * 
 * 交互流程:
 * 1. 用户点击按钮触发 uploadFiles()
 * 2. uploadFiles() 调用 fileInput.click() 打开文件选择器
 * 3. 用户选择文件后触发 onchange 事件
 * 4. handleFileChange() 处理选中的文件
 */ -->
<input
	bind:this={fileInput}
	type="file"
	multiple
	class="hidden"
	onchange={handleFileChange}
/>

<!-- /**
 * 上传按钮
 * 
 * 功能: 作为主要的文件上传入口
 * 
 * 交互:
 * - onclick: 点击时触发 uploadFiles()
 * - bind:this: 绑定元素引用用于添加事件监听器
 * 
 * 样式说明:
 * - hover:scale-105: 悬停时放大 5%
 * - active:scale-100: 按下时恢复原始大小
 * - duration-200: 动画过渡时长 200ms
 * - $effects: 根据全局效果开关动态调整缩放行为
 */ -->
<button
	onclick={uploadFiles}
	bind:this={uploaderButton}
	class={clsx(
		// 基础样式：悬停放大效果 + 动画时长 + 外部传入的类名
		`hover:scale-105 active:scale-100 ${$effects ? "" : "!scale-100"} duration-200 ${classList}`,
	)}
>
	<!-- /**
	 * 面板容器
	 * 
	 * 功能: 提供统一的卡片样式和布局
	 * 
	 * 样式说明:
	 * - flex-col: 垂直排列子元素
	 * - justify-center: 垂直居中
	 * - items-center: 水平居中
	 * - w-full h-full: 占满父容器
	 * - pointer-events-none: 允许点击穿透，使面板可交互
	 */ -->
	<Panel
		class="flex justify-center items-center w-full h-full flex-col pointer-events-none"
	>
		<!-- /**
		 * 图标容器
		 * 
		 * 样式说明:
		 * - w-16 h-16: 64x64 像素的正方形
		 * - bg-accent: 主题色背景
		 * - rounded-full: 圆形
		 * - p-4: 内边距，使图标不贴边
		 */ -->
		<div
			class="w-16 h-16 bg-accent rounded-full flex items-center justify-center p-4"
		>
			<!-- /**
			 * 上传图标
			 * 
			 * 图标说明:
			 * - w-full h-full: 占满父容器
			 * - text-on-accent: 在主题色上的文字颜色
			 */ -->
			<UploadIcon class="w-full h-full text-on-accent" />
		</div>
		
		<!-- /**
		 * 标题文字
		 * 
		 * 国际化:
		 * - 使用 m["upload.uploader.text"] 获取主文本
		 * - 动态参数 action 由 m["upload.uploader.convert"] 提供
		 * 
		 * 样式说明:
		 * - text-2xl: 大号字体
		 * - font-semibold: 半粗体
		 * - mt-4: 上方间距 16px
		 */ -->
		<h2 class="text-center text-2xl font-semibold mt-4">
			{m["upload.uploader.text"]({
				action: m["upload.uploader.convert"]()
			})}
		</h2>
	</Panel>
</button>
