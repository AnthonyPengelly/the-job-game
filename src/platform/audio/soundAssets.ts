/**
 * Bundled sound asset resolver.
 *
 * Uses Vite's import.meta.glob to pull all WAV files from src/platform/audio/sounds/
 * into the module graph. With assetsInlineLimit: () => true in the offline build
 * each URL becomes a data: URI that fetch() can resolve under file://.
 * In dev mode the URLs are localhost paths served by the Vite dev server.
 *
 * Engine.ts stays clean of bundler specifics — this module produces a
 * fetchBuffer function that AudioProvider injects via AudioEngineOptions.
 */

const _glob = import.meta.glob('./sounds/*.wav', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// Map "sound/filename.wav" → bundled URL (data: URI in offline build)
const _soundMap = new Map<string, string>(
  Object.entries(_glob).map(([path, url]) => {
    const filename = path.split('/').pop()!;
    return [`sound/${filename}`, url] as [string, string];
  }),
);

/**
 * Resolves a manifest logical cue src (e.g. "sound/ambient-drone.wav") to a
 * Vite-bundled URL. Throws loudly for unknown srcs so a missing file is caught
 * at dev time rather than silently failing at the table.
 */
export function resolveSoundUrl(logicalSrc: string): string {
  const url = _soundMap.get(logicalSrc);
  if (url === undefined) {
    throw new Error(
      `[soundAssets] No bundled asset for "${logicalSrc}". ` +
        'Add the file to src/platform/audio/sounds/.',
    );
  }
  return url;
}

/**
 * Returns a fetchBuffer function for AudioEngineOptions that resolves each
 * manifest logical src to its bundled URL before fetching. fetch('data:…')
 * succeeds under file://, making audio preload work in the offline build.
 */
export function createBundledFetchBuffer(): (src: string) => Promise<ArrayBuffer> {
  return async (src: string): Promise<ArrayBuffer> => {
    const url = resolveSoundUrl(src);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(
        `[soundAssets] HTTP ${resp.status} fetching "${src}" (resolved: ${url})`,
      );
    }
    return resp.arrayBuffer();
  };
}
