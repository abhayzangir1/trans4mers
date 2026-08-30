import { create } from 'zustand';

export type CenterPaneTab = 'map' | 'slack';
export type RightPaneState = 'files' | 'editor' | 'terminal' | 'uploads' | 'tasks';

interface OSState {
  // Sidebar toggles
  isLeftSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  openLeftSidebar: () => void;
  closeLeftSidebar: () => void;
  isRightSidebarOpen: boolean;
  toggleRightSidebar: () => void;
  openRightSidebar: () => void;
  closeRightSidebar: () => void;

  // View States
  centerPaneTab: CenterPaneTab;
  setCenterPaneTab: (tab: CenterPaneTab) => void;
  
  rightPaneState: RightPaneState;
  setRightPaneState: (state: RightPaneState) => void;

  // Editor State
  activeFilePath: string | null;
  setActiveFile: (path: string | null) => void;

  // Transient Global UI state
  isSettingsModalOpen: boolean;
  setSettingsModalOpen: (isOpen: boolean) => void;
}

export const useOSStore = create<OSState>((set) => ({
  isLeftSidebarOpen: true,
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
  openLeftSidebar: () => set((state) => state.isLeftSidebarOpen ? state : { isLeftSidebarOpen: true }),
  closeLeftSidebar: () => set((state) => !state.isLeftSidebarOpen ? state : { isLeftSidebarOpen: false }),
  
  isRightSidebarOpen: true,
  toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
  openRightSidebar: () => set((state) => state.isRightSidebarOpen ? state : { isRightSidebarOpen: true }),
  closeRightSidebar: () => set((state) => !state.isRightSidebarOpen ? state : { isRightSidebarOpen: false }),

  centerPaneTab: 'slack',
  setCenterPaneTab: (tab) => set({ centerPaneTab: tab }),

  rightPaneState: 'files',
  setRightPaneState: (state) => set({ rightPaneState: state, isRightSidebarOpen: true }),

  activeFilePath: null,
  setActiveFile: (path) => set({ activeFilePath: path, rightPaneState: path ? 'editor' : 'files', isRightSidebarOpen: true }),

  isSettingsModalOpen: false,
  setSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),
}));
