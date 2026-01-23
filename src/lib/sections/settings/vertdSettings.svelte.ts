import { type IpInfo } from "$lib/util/ip";
import { Settings } from "./index.svelte";
import { PUB_VERTD_URL } from "$env/static/public";

/**
 * 可用的官方 VERT 服务器实例列表及其地理坐标。
 * 用于自动将用户路由到最近的服务器。
 */
const LOCATIONS = [
	{
		latitude: 49.0976,
		longitude: 12.4869,
		url: "https://eu.vertd.vert.sh",
	},
	{
		latitude: 47.6587,
		longitude: -117.426,
		url: "https://usa.vertd.vert.sh",
	},
];

const toRad = (value: number) => (value * Math.PI) / 180;

/**
 * 根据经纬度计算球体上两点之间的大圆距离。
 * 用于确定离用户最近的服务器实例。
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 */
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
	const R = 6371; // 地球半径（千米）
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const d = R * c;
	return d;
};

/**
 * Vertd 连接的配置状态。
 * - auto: 自动选择最近的可访问服务器。
 * - eu/us: 强制连接到特定的官方实例。
 * - custom: 使用用户自定义的 URL。
 */
export type VertdInner =
	| { type: "auto" }
	| { type: "eu" }
	| { type: "us" }
	| { type: "custom" };

/**
 * 管理视频转换后端 (vertd) 连接设置的单例类。
 * 处理延迟检查、自动服务器选择和持久化。
 */
export class VertdInstance {
	public static instance = new VertdInstance();

	private cachedIp = $state<IpInfo | null>(null);

	private inner = $state<VertdInner>({
		type: "custom",
	});

	/** 将当前设置持久化到 localStorage */
	public save() {
		localStorage.setItem("vertdInstance", JSON.stringify(this.inner));
	}

	/** 从 localStorage 加载设置或初始化默认值 */
	public load() {
		const ls = localStorage.getItem("vertdInstance");

		// if custom vertd url and no saved setting, default to the custom url
		if (!ls) {
			const isCustomUrl =
				PUB_VERTD_URL && PUB_VERTD_URL !== "https://vertd.vert.sh";
			if (isCustomUrl) {
				this.inner = { type: "custom" };
				return;
			}
		}

		if (!ls) return;
		const inner: VertdInner = JSON.parse(ls);
		this.inner = {
			...this.inner,
			...inner,
		};
	}

	public innerData() {
		return this.inner;
	}

	public set(inner: VertdInner) {
		this.inner = inner;
		this.save();
	}

	/**
	 * 根据配置和可用性确定活动的服务器 URL。
	 * 在 'auto' 模式下，它尝试连接地理位置最近的服务器，
	 * 如果主服务器不可达，则回退到其他服务器。
	 */
	public async url() {
		// const reachable = async (url: string) => {
		// 	try {
		// 		const res = await fetch(url + "/api/version", {
		// 			method: "GET",
		// 			cache: "no-store",
		// 		});
		// 		return res.ok;
		// 	} catch {
		// 		return false;
		// 	}
		// };

		switch (this.inner.type) {
			case "auto": {
				/*
				// 已禁用自动路由逻辑
				if (!this.cachedIp) this.cachedIp = await ip();
				const ipInfo = this.cachedIp;
				const primary = this.geographicallyOptimalInstance(ipInfo);

				// try primary (closest) first
				if (await reachable(primary)) return primary;

				// fall back to other locations
				for (const location of LOCATIONS) {
					if (location.url === primary) continue;
					if (await reachable(location.url)) return location.url;
				}
				*/

				// if none are reachable, fall back to custom
				return Settings.instance.settings.vertdURL;
			}

			case "eu": {
				return "https://eu.vertd.vert.sh";
			}

			case "us": {
				return "https://usa.vertd.vert.sh";
			}

			case "custom": {
				return Settings.instance.settings.vertdURL;
			}
		}
	}

	/**
	 * 查找与用户 IP 位置物理距离最小的服务器实例。
	 */
	private geographicallyOptimalInstance(ip: IpInfo) {
		let bestLocation = LOCATIONS[0];
		let bestDistance = haversine(
			ip.latitude,
			ip.longitude,
			bestLocation.latitude,
			bestLocation.longitude,
		);

		for (let i = 1; i < LOCATIONS.length; i++) {
			const location = LOCATIONS[i];
			const distance = haversine(
				ip.latitude,
				ip.longitude,
				location.latitude,
				location.longitude,
			);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestLocation = location;
			}
		}

		return bestLocation.url;
	}
}
