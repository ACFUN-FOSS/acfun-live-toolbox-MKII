import { MessagePlugin } from 'tdesign-vue-next';

export function formatCompact(n?: number | null): string {
  if (n == null) return '-';
  const num = Number(n);
  if (Number.isNaN(num)) return '-';
  if (num < 10000) return String(num);
  const w = num / 10000;
  return `${w.toFixed(w >= 10 ? 0 : 1)}万`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    MessagePlugin.success('已复制');
    return true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      MessagePlugin.success('已复制');
      return true;
    } catch {
      MessagePlugin.error('复制失败');
      return false;
    }
  }
}