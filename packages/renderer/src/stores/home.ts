import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRoleStore } from './role';

type CardKey = 'A' | 'B' | 'C' | 'D';

interface DocItem {
  title: string;
  desc: string;
  link: string;
}

export const useHomeStore = defineStore('home', () => {
  const loading = ref<Record<CardKey, boolean>>({ A: false, B: false, C: false, D: false });
  const error = ref<Record<CardKey, string | null>>({ A: null, B: null, C: null, D: null });

  const userInfo = ref<any>(null);
  const docs = ref<DocItem[]>([]);
  const anchorStats = ref<{ lastSessionAt?: string; followers?: number; giftIncome?: number } | null>(null);
  const modRooms = ref<Array<{ roomId: string; title: string; cover?: string; status?: string }>>([]);
  const devMetrics = ref<{ errorCount: number; messageCount: number; uniqueErrorTypes: number } | null>(null);

  async function fetchUserInfo() {
    loading.value.B = true; error.value.B = null;
    try {
      if (window.electronApi?.account?.getUserInfo) {
        const u = await window.electronApi.account.getUserInfo();
        userInfo.value = u;
      } else {
        throw new Error('IPC account.getUserInfo not available');
      }
    } catch (e: any) {
      error.value.B = e?.message || '获取用户信息失败';
    } finally {
      loading.value.B = false;
    }
  }

  async function fetchDocs() {
    loading.value.D = true; error.value.D = null;
    try {
      // Static docs list as initial implementation; future: HTTP/IPC bridge
      docs.value = [
        { title: '快速上手', desc: '了解如何使用工具箱进行直播辅助', link: '/system/develop' },
        { title: 'API 文档', desc: '插件与系统接口说明', link: '/system/develop' },
        { title: '常见问题', desc: '排查与解决常见问题的指南', link: '/system/develop' },
      ];
    } catch (e: any) {
      error.value.D = e?.message || '获取文档列表失败';
    } finally {
      loading.value.D = false;
    }
  }

  async function fetchRoleSpecific() {
    const roleStore = useRoleStore();
    loading.value.C = true; error.value.C = null;
    try {
      if (roleStore.current === 'anchor') {
        // Snapshot-like demo values; real implementation should read via transport selector
        anchorStats.value = {
          lastSessionAt: new Date(Date.now() - 86400000).toISOString(),
          followers: 12840,
          giftIncome: 3240,
        };
      } else if (roleStore.current === 'moderator') {
        // Use room store if available; else provide empty list
        try {
          const { useRoomStore } = await import('./room');
          const rs = useRoomStore();
          const list = (rs.rooms as any[]) || [];
          modRooms.value = (list || []).slice(0, 2).map((r: any) => ({
            roomId: String(r.roomId || r.id || ''),
            title: r.title || r.roomName || '直播间',
            cover: r.cover || r.coverUrl,
            status: r.status || r.liveStatus,
          }));
        } catch {
          modRooms.value = [];
        }
      } else if (roleStore.current === 'developer') {
        try {
          const { useConsoleStore } = await import('./console');
          const cs = useConsoleStore();
          const errorCount = Array.isArray((cs as any).errors) ? (cs as any).errors.length : 0;
          const messageCount = Array.isArray((cs as any).messages) ? (cs as any).messages.length : 0;
          const uniqueErrorTypes = 1; // Placeholder unless console store exposes types
          devMetrics.value = { errorCount, messageCount, uniqueErrorTypes };
        } catch {
          devMetrics.value = { errorCount: 0, messageCount: 0, uniqueErrorTypes: 0 };
        }
      }
    } catch (e: any) {
      error.value.C = e?.message || '获取角色相关数据失败';
    } finally {
      loading.value.C = false;
    }
  }

  async function initialize() {
    // GET_ROLE -> GET_USER -> Parallel(C role data) -> GET_DOCS
    loading.value.A = true; error.value.A = null;
    try {
      // GET_ROLE implicitly handled via role store init
      await fetchUserInfo();
      await Promise.all([fetchRoleSpecific(), fetchDocs()]);
    } catch (e: any) {
      error.value.A = e?.message || '主页初始化失败';
    } finally {
      loading.value.A = false;
    }
  }

  function retryCard(card: CardKey) {
    if (card === 'B') return fetchUserInfo();
    if (card === 'C') return fetchRoleSpecific();
    if (card === 'D') return fetchDocs();
    return initialize();
  }

  return {
    loading,
    error,
    userInfo,
    docs,
    anchorStats,
    modRooms,
    devMetrics,
    initialize,
    retryCard,
    fetchRoleSpecific,
  };
});