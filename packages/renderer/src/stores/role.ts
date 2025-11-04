import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type AppRole = 'anchor' | 'moderator' | 'developer';
export type StatsScope = '7d' | '30d';

export const useRoleStore = defineStore('role', () => {
  const options = ref<AppRole[]>(['anchor', 'moderator', 'developer']);
  const current = ref<AppRole>('anchor');
  const statsScope = ref<StatsScope>('7d');
  const firstLoginRoleDialogVisible = ref(false);

  // Initialize from persisted storage
  function initRole() {
    const saved = localStorage.getItem('role.current');
    if (saved && (options.value as string[]).includes(saved)) {
      current.value = saved as AppRole;
    } else {
      // No persisted role -> show first login role dialog
      firstLoginRoleDialogVisible.value = true;
    }
    const savedScope = localStorage.getItem('role.statsScope');
    if (savedScope === '7d' || savedScope === '30d') {
      statsScope.value = savedScope as StatsScope;
    }
  }

  function setRole(role: AppRole) {
    if (!(options.value as string[]).includes(role)) return;
    current.value = role;
    localStorage.setItem('role.current', role);
  }

  function confirmFirstLoginRole() {
    // Persist and close dialog
    localStorage.setItem('role.current', current.value);
    firstLoginRoleDialogVisible.value = false;
  }

  function setStatsScope(scope: StatsScope) {
    statsScope.value = scope;
    localStorage.setItem('role.statsScope', scope);
  }

  const isRoleDialogVisible = computed(() => firstLoginRoleDialogVisible.value);

  // Boot
  initRole();

  return {
    options,
    current,
    statsScope,
    firstLoginRoleDialogVisible,
    isRoleDialogVisible,
    setRole,
    confirmFirstLoginRole,
    setStatsScope,
  };
});