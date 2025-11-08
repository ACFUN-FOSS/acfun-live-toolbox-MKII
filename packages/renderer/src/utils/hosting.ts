export type HostingPageType = 'ui' | 'window' | 'overlay';

interface HostingConfigItem {
  spa: boolean;
  route: string;
  html: string;
}

interface HostingConfig {
  ui: HostingConfigItem | null;
  window: HostingConfigItem | null;
  overlay: HostingConfigItem | null;
}

export function getApiBase(): string {
  // Prefer Electron-preload configured env, fallback to default
  const port = (process?.env?.ACFRAME_API_PORT as string) || '18299';
  return `http://127.0.0.1:${port}`;
}

export async function getPluginHostingConfig(pluginId: string): Promise<HostingConfig> {
  const res = await window.electronApi.hosting.getConfig(pluginId);
  if (res && 'success' in res && res.success) {
    return res.data as HostingConfig;
  }
  throw new Error((res as any)?.error || 'Failed to get hosting config');
}

/**
 * Choose a primary hosting type between UI and Window.
 * Policy: prefer `ui` when both are present; fallback to `window`.
 * Overlay is independent and may coexist.
 */
export function resolvePrimaryHostingFromConfig(conf: HostingConfig): {
  type: 'ui' | 'window' | null;
  item?: HostingConfigItem;
} {
  // Prefer UI if declared; else use Window; else none
  if (conf.ui) return { type: 'ui', item: conf.ui };
  if (conf.window) return { type: 'window', item: conf.window };
  return { type: null };
}

export async function resolvePrimaryHostingType(pluginId: string): Promise<{
  type: 'ui' | 'window' | null;
  item?: HostingConfigItem;
}> {
  const conf = await getPluginHostingConfig(pluginId);
  return resolvePrimaryHostingFromConfig(conf);
}

export function buildPluginPageUrl(
  pluginId: string,
  type: HostingPageType,
  conf?: Partial<HostingConfigItem>
): string {
  const base = getApiBase();
  const scope = `/plugins/${pluginId}/${type}`;

  // SPA: serve entry at scope; optionally pass route as query for initial navigation
  if (conf?.spa) {
    const url = new URL(scope, base);
    const route = conf.route || '/';
    if (route && route !== '/') {
      url.searchParams.append('route', route);
    }
    return url.toString();
  }

  // Non-SPA: serve specific html entry (defaults to <type>.html)
  const html = conf?.html || `${type}.html`;
  const url = new URL(`/plugins/${pluginId}/${html}`, base);
  return url.toString();
}

export async function resolveOverlayWujieUrl(pluginId: string): Promise<{
  url: string;
  name: string;
  props: Record<string, any>;
}> {
  const hosting = await getPluginHostingConfig(pluginId);
  const conf = hosting.overlay || undefined;
  const url = buildPluginPageUrl(pluginId, 'overlay', conf || {});
  return {
    url,
    name: `overlay-${pluginId}`,
    props: { pluginId },
  };
}

/**
 * Build external wrapper base URL for overlay.
 * The server will resolve manifest settings (spa/route/html) internally.
 */
export function buildOverlayWrapperBase(pluginId: string): string {
  const base = getApiBase();
  const url = new URL('/overlay-wrapper', base);
  url.searchParams.set('plugin', pluginId);
  url.searchParams.set('type', 'overlay');
  return url.toString();
}

/**
 * Build external wrapper URL with overlayId.
 */
export function buildOverlayWrapperUrl(pluginId: string, overlayId: string): string {
  const base = getApiBase();
  const url = new URL('/overlay-wrapper', base);
  url.searchParams.set('plugin', pluginId);
  url.searchParams.set('type', 'overlay');
  url.searchParams.set('overlayId', overlayId);
  return url.toString();
}
