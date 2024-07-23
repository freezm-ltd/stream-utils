export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mergeSignal(signal1: AbortSignal, signal2: AbortSignal) {
	const controller = new AbortController()
	signal1.onabort = (e) => controller.abort((e.target as AbortSignal).reason)
	signal2.onabort = (e) => controller.abort((e.target as AbortSignal).reason)
	return controller.signal
}