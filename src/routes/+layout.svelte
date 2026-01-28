<script lang="ts">
	import { onMount } from "svelte";
	import { goto, beforeNavigate, afterNavigate } from "$app/navigation";

	import { PUB_PLAUSIBLE_URL, PUB_HOSTNAME } from "$env/static/public";
	import { DISABLE_ALL_EXTERNAL_REQUESTS, VERT_NAME } from "$lib/util/consts.js";
	import * as Layout from "$lib/components/layout";
	import * as Navbar from "$lib/components/layout/Navbar";
	import featuredImage from "$lib/assets/VERT_Feature.webp";
	import { Settings } from "$lib/sections/settings/index.svelte";
	import {
		files,
		isMobile,
		effects,
		theme,
		dropping,
		vertdLoaded,
		locale,
		updateLocale,
    incrementConversionCount
	} from "$lib/store/index.svelte";
	import "$lib/css/app.scss";
	import { browser } from "$app/environment";
	import { initStores as initAnimStores } from "$lib/util/animation.js";
	import { VertdInstance } from "$lib/sections/settings/vertdSettings.svelte.js";
	import { ToastManager } from "$lib/util/toast.svelte.js";
	import { m } from "$lib/paraglide/messages.js";
	import { log } from "$lib/util/logger.js";

	let { children, data } = $props();
	let enablePlausible = $state(false);

	let scrollPositions = new Map<string, number>();

	beforeNavigate((nav) => {
		if (!nav.from || !$isMobile) return;
		scrollPositions.set(nav.from.url.pathname, window.scrollY);
	});

	afterNavigate((nav) => {
		if (!$isMobile) return;
		const scrollY = nav.to
			? scrollPositions.get(nav.to.url.pathname) || 0
			: 0;
		window.scrollTo(0, scrollY);
	});

	const dropFiles = (e: DragEvent) => {
		e.preventDefault();
		dropping.set(false);
		const oldLength = files.files.length;
		files.add(e.dataTransfer?.files);
		if (oldLength !== files.files.length) goto("/convert");
	};

	const handleDrag = (e: DragEvent, drag: boolean) => {
		e.preventDefault();
		dropping.set(drag);
	};

	const handlePaste = (e: ClipboardEvent) => {
		const clipboardData = e.clipboardData;
		if (!clipboardData || !clipboardData.files.length) return;
		e.preventDefault();
		const oldLength = files.files.length;
		files.add(clipboardData.files);
		if (oldLength !== files.files.length) goto("/convert");
	};

	onMount(() => {
		initAnimStores();

		const handleResize = () => {
			isMobile.set(window.innerWidth <= 768);
		};

		isMobile.set(window.innerWidth <= 768); // initial page load
		window.addEventListener("resize", handleResize); // handle window resize
		window.addEventListener("paste", handlePaste);
		// 添加添加事件
		console.log("添加监听事件")
		// 添加全局事件通信，用于接收父级发送的消息
		window.addEventListener('message', (event) => {
			// Security Check: Verify origin if needed
			console.log('收到父页面消息：', event);
			if (event.origin !== 'http://192.168.2.242:8136') return;
      if (event.data?.type !== 'INIT_DATA') return;
      const converterCount = event.data?.count || 0;
      incrementConversionCount(converterCount);
      // 设置语言
      console.log(event.data?.locale, "设置语言")
      localStorage.setItem("locale", (event.data?.locale || "en"));
		});
		// Global iframe communication listener (Example)
    window.parent.postMessage(
      { type: 'IFRAME_READY', message: "loadFinish" },
      'http://192.168.2.242:8136'
    );

		effects.set(localStorage.getItem("effects") !== "false"); // defaults to true if not set
		theme.set(
			(localStorage.getItem("theme") as "light" | "dark") || "light",
		);
		const storedLocale = localStorage.getItem("locale");
		if (storedLocale) updateLocale(storedLocale);

		Settings.instance.load();

		if (!DISABLE_ALL_EXTERNAL_REQUESTS) {
			VertdInstance.instance
				.url()
				.then((u) => fetch(`${u}/api/version`))
				.then((res) => {
					if (res.ok) $vertdLoaded = true;
				});
		}

		// detect if insecure context
		// Https 提示弹窗
		// if (!window.isSecureContext) {
		// 	log(["layout"], "Insecure context (HTTP) detected, some features may not work as expected -- you may want to enable \"PUB_DISABLE_FAILURE_BLOCKS\" on local deployments.");
		// 	ToastManager.add({
		// 		type: "warning",
		// 		message: m["toast.insecure_context"](),
		// 		disappearing: false,
		// 	});
		// }

		// --- Dynamic Iframe Resizing ---
		const sendHeight = () => {
			if (!browser) return;
			const height = Math.max(
				document.body.scrollHeight,
				document.documentElement.scrollHeight
			);
			window.parent.postMessage({ type: 'VERT_RESIZE', height }, '*');
		};

		let resizeTimeout: number;
		const debouncedSendHeight = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = window.setTimeout(sendHeight, 100);
		};

		const resizeObserver = new ResizeObserver(() => {
			debouncedSendHeight();
		});

		if (browser) {
			resizeObserver.observe(document.body);
			resizeObserver.observe(document.documentElement);
			// Also listen for image loading which might change height
			window.addEventListener('load', debouncedSendHeight);
			// Initial send
			sendHeight();
		}

		return () => {
			window.removeEventListener("paste", handlePaste);
			window.removeEventListener("resize", handleResize);
			if (browser) {
				window.removeEventListener('load', debouncedSendHeight);
				resizeObserver.disconnect();
				clearTimeout(resizeTimeout);
			}
		};
	});

	$effect(() => {
		enablePlausible =
			!!PUB_PLAUSIBLE_URL &&
			!PUB_PLAUSIBLE_URL.includes("example.com") &&
			Settings.instance.settings.plausible &&
			!DISABLE_ALL_EXTERNAL_REQUESTS;
		if (!enablePlausible && browser) {
			// reset pushState on opt-out so that plausible stops firing events on page navigation
			history.pushState = History.prototype.pushState;
		}
	});
</script>

<svelte:head>
	<title>{VERT_NAME}</title>
	<meta name="theme-color" content="#F2ABEE" />
	<meta
		name="title"
		content="{VERT_NAME} — Free, fast, and awesome file converter"
	/>
	<meta
		name="description"
		content="With VERT, you can quickly convert any image, video, audio, and document file. No ads, no tracking, open source, and all processing (other than video) is done on your device."
	/>
	<meta property="og:url" content="https://vert.sh" />
	<meta property="og:type" content="website" />
	<meta
		property="og:title"
		content="{VERT_NAME} — Free, fast, and awesome file converter"
	/>
	<meta
		property="og:description"
		content="With VERT, you can quickly convert any image, video, audio, and document file. No ads, no tracking, open source, and all processing (other than video) is done on your device."
	/>
	<meta property="og:image" content={featuredImage} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content="vert.sh" />
	<meta property="twitter:url" content="https://vert.sh" />
	<meta
		property="twitter:title"
		content="{VERT_NAME} — Free, fast, and awesome file converter"
	/>
	<meta
		property="twitter:description"
		content="With VERT, you can quickly convert any image, video, audio, and document file. No ads, no tracking, open source, and all processing (other than video) is done on your device."
	/>
	<meta property="twitter:image" content={featuredImage} />
	<link rel="manifest" href="/manifest.json" />
	<link rel="canonical" href="https://vert.sh/" />
	{#if enablePlausible}
		<script
			defer
			data-domain={PUB_HOSTNAME || "vert.sh"}
			src="{PUB_PLAUSIBLE_URL}/js/script.js"
		></script>
	{/if}
	{#if data.isAprilFools}
		<style>
			* {
				font-family: "Comic Sans MS", "Comic Sans", cursive !important;
			}
		</style>
	{/if}
</svelte:head>

<!-- FIXME: if user resizes between desktop/mobile, highlight of page disappears (only shows on original size) -->
{#key $locale}
	<div
		class="flex flex-col min-h-screen h-full w-full overflow-x-hidden"
		ondrop={dropFiles}
		ondragenter={(e) => handleDrag(e, true)}
		ondragover={(e) => handleDrag(e, true)}
		ondragleave={(e) => handleDrag(e, false)}
		role="region"
	>
		<Layout.UploadRegion />

		<div>
			<!-- <Layout.MobileLogo /> -->
			<!-- <Navbar.Desktop /> -->
		</div>

		<!-- 
		SvelteKit throws the following warning when developing - safe to ignore as we render the children in this component:
		`<slot />` or `{@render ...}` tag missing — inner content will not be rendered
		-->
		<Layout.PageContent {children} />

		<Layout.Toasts />
		<Layout.Dialogs />

		<div>
			<!-- <Layout.Footer /> -->
			<!-- <Navbar.Mobile /> -->
		</div>
	</div>
{/key}

<!-- Gradients placed here to prevent it overlapping in transitions -->
<Layout.Gradients />
