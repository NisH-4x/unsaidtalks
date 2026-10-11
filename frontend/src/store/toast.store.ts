import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  push: (text: string, tone?: ToastTone, action?: ToastAction) => void;
  dismiss: (id: number) => void;
}

const VISIBLE_MS = 4_000;
const VISIBLE_WITH_ACTION_MS = 7_000;
let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (text, tone = 'info', action) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, tone, text, action }] }));
    window.setTimeout(() => get().dismiss(id), action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function showToast(text: string, tone: ToastTone = 'info', action?: ToastAction): void {
  useToastStore.getState().push(text, tone, action);
}
