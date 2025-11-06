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

function getApiBase(): string {
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