'use client'

import { create } from 'zustand'

export type View =
  | 'welcome'
  | 'auth'
  | 'home'
  | 'member-join'
  | 'cricket'
  | 'football'
  | 'drawing'
  | 'blood'
  | 'gallery'
  | 'admin'
  | 'notice'
  | 'events'
  | 'more'
  | 'members'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
}

/** keep the navigation history bounded */
const MAX_STACK = 30

interface AppState {
  view: View
  /** in-app navigation history — powers the Android hardware back button */
  viewStack: View[]
  user: SessionUser | null
  booted: boolean
  donationOpen: boolean
  setView: (v: View, opts?: { push?: boolean }) => void
  /** walk one step back through the in-app history; returns the previous view or null at the root */
  goBack: () => View | null
  setUser: (u: SessionUser | null) => void
  setBooted: (b: boolean) => void
  setDonationOpen: (v: boolean) => void
}

export const useApp = create<AppState>((set, get) => ({
  view: 'welcome',
  viewStack: [],
  user: null,
  booted: false,
  donationOpen: false,
  // Navigate to a view. By default the previous view is recorded on the back
  // stack so the Android hardware back button can walk the user's own path:
  // page → previous page → … → home → exit dialog.
  // `push: false` marks redirect-style jumps (auth guard) that must not
  // pollute the history.
  setView: (view, opts) =>
    set((state) => {
      if (state.view === view) return state
      // fresh starts: entering home/admin after login or welcome after logout
      // clear the history so "back" ends at the exit dialog instead of stale
      // pre-login screens.
      const freshStart = view === 'home' || view === 'admin' || view === 'welcome'
      const viewStack = freshStart
        ? []
        : opts?.push === false
          ? state.viewStack
          : [...state.viewStack, state.view].slice(-MAX_STACK)
      return { view, viewStack }
    }),
  goBack: () => {
    const { viewStack } = get()
    if (viewStack.length === 0) return null
    const prev = viewStack[viewStack.length - 1]
    set({ view: prev, viewStack: viewStack.slice(0, -1) })
    return prev
  },
  setUser: (user) => set({ user }),
  setBooted: (booted) => set({ booted }),
  setDonationOpen: (donationOpen) => set({ donationOpen }),
}))
