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

interface AppState {
  view: View
  user: SessionUser | null
  booted: boolean
  donationOpen: boolean
  setView: (v: View) => void
  setUser: (u: SessionUser | null) => void
  setBooted: (b: boolean) => void
  setDonationOpen: (v: boolean) => void
}

export const useApp = create<AppState>((set) => ({
  view: 'welcome',
  user: null,
  booted: false,
  donationOpen: false,
  setView: (view) => set({ view }),
  setUser: (user) => set({ user }),
  setBooted: (booted) => set({ booted }),
  setDonationOpen: (donationOpen) => set({ donationOpen }),
}))
