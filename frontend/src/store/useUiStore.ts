import { create } from 'zustand';

interface UiState {
  selectedAccountIds: number[];
  sidebarOpen: boolean;
  hideBalanceOverride: boolean;
  
  // Actions
  setSelectedAccountIds: (ids: number[]) => void;
  toggleAccountId: (id: number) => void;
  clearAccountFilters: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleHideBalance: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedAccountIds: [],
  sidebarOpen: false,
  hideBalanceOverride: false,

  setSelectedAccountIds: (ids) => set({ selectedAccountIds: ids }),

  toggleAccountId: (id) => set((state) => {
    const isSelected = state.selectedAccountIds.includes(id);
    const updated = isSelected 
      ? state.selectedAccountIds.filter(x => x !== id)
      : [...state.selectedAccountIds, id];
    return { selectedAccountIds: updated };
  }),

  clearAccountFilters: () => set({ selectedAccountIds: [] }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleHideBalance: () => set((state) => ({ hideBalanceOverride: !state.hideBalanceOverride }))
}));
