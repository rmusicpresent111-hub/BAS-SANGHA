'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  Bell,
  Camera,
  ChevronRight,
  HandCoins,
  LogOut,
  Mail,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import { apiFetch, clearToken } from '@/lib/api'
import { pushLocallyEnabled, pushSupported, enablePush, disablePush } from '@/lib/push'
import { ScreenHeader } from './common'
import MainShell from './MainShell'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Switch } from '@/components/ui/switch'

interface Row {
  label: string
  sub: string
  Icon: typeof UserPlus
  chip: string
  onClick: () => void
}

export default function MoreScreen() {
  const { user, setView, setUser, setDonationOpen } = useApp()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    setPushOn(
      pushSupported() &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        pushLocallyEnabled()
    )
  }, [])

  const togglePush = async (on: boolean) => {
    setPushBusy(true)
    try {
      if (on) {
        const r = await enablePush()
        if (!r.ok) {
          toast({ title: 'Notification চালু হয়নি', description: r.error, variant: 'destructive' })
          return
        }
        setPushOn(true)
        toast({ title: 'Notification চালু হয়েছে 🔔', description: 'পূজা, নোটিশ ও ইভেন্ট আপডেট এখন পাবেন।' })
      } else {
        await disablePush()
        setPushOn(false)
        toast({ title: 'Notification বন্ধ করা হয়েছে' })
      }
    } finally {
      setPushBusy(false)
    }
  }

  const logout = async () => {
    clearToken()
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // server unreachable — still log out locally; token is already cleared
    } finally {
      setUser(null)
      setView('welcome')
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      const res = await apiFetch('/api/auth/account', { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast({
          title: 'সমস্যা হয়েছে',
          description: d.error || 'Account delete করা যায়নি — আবার চেষ্টা করুন।',
          variant: 'destructive',
        })
        return
      }
      clearToken()
      setUser(null)
      setView('welcome')
      toast({ title: 'Account delete হয়েছে', description: 'আপনার তথ্য মুছে ফেলা হয়েছে।' })
    } catch {
      toast({
        title: 'সমস্যা হয়েছে',
        description: 'নেটওয়ার্ক সমস্যা — Account delete করা যায়নি, আবার চেষ্টা করুন।',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const rows: Row[] = [
    {
      label: 'Member Join',
      sub: 'নতুন সদস্য হিসেবে যুক্ত হোন',
      Icon: UserPlus,
      chip: 'bg-amber-100 text-amber-600',
      onClick: () => setView('member-join'),
    },
    {
      label: 'সদস্য তালিকা',
      sub: 'সম্পূর্ণ কমিটি ও সদস্যদের তালিকা',
      Icon: Users,
      chip: 'bg-blue-100 text-blue-700',
      onClick: () => setView('members'),
    },
    {
      label: 'গ্যালারি',
      sub: 'বছরের পর বছরের স্মৃতি',
      Icon: Camera,
      chip: 'bg-rose-100 text-rose-600',
      onClick: () => setView('gallery'),
    },
    {
      label: 'Donate Now',
      sub: 'UPI payment — GPay / PhonePe / Paytm + receipt',
      Icon: HandCoins,
      chip: 'bg-emerald-100 text-emerald-600',
      onClick: () => setDonationOpen(true),
    },
    {
      label: 'Contact Us',
      sub: 'bhoreraalosyamasangha@gmail.com',
      Icon: Mail,
      chip: 'bg-sky-100 text-sky-700',
      onClick: () => {
        window.location.href = 'mailto:bhoreraalosyamasangha@gmail.com?subject=' + encodeURIComponent('B.A.S Sangha — যোগাযোগ')
      },
    },
  ]

  return (
    <MainShell>
      <ScreenHeader title="আরও অপশন" subtitle="More options" onBack={() => setView('home')} accent="blue" />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-3 py-5">
        {/* club card */}
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white shadow ring-2 ring-amber-300">
            <Image src="/logo.png" alt="B.A.S Sangha logo" width={56} height={56} className="h-full w-full object-contain p-1" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-black text-blue-950">B.A.S SANGHA</p>
            <p className="truncate text-xs text-stone-500">Dakshin Gobindapur • Estd 2021</p>
            <p className="truncate text-[11px] font-semibold text-blue-700">{user?.name} ({user?.email})</p>
          </div>
        </div>

        {/* rows */}
        <div className="space-y-2.5">
          {rows.map((r) => (
            <button
              key={r.label}
              onClick={r.onClick}
              className="flex w-full items-center gap-3 rounded-2xl border border-stone-100 bg-white p-3.5 text-left shadow-sm transition hover:bg-stone-50 active:scale-[0.99]"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${r.chip}`}>
                <r.Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-stone-800">{r.label}</span>
                <span className="block truncate text-[11px] text-stone-400">{r.sub}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
            </button>
          ))}

          {/* notifications toggle */}
          <div className="flex w-full items-center gap-3 rounded-2xl border border-stone-100 bg-white p-3.5 shadow-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Bell className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-stone-800">Notifications</span>
              <span className="block truncate text-[11px] text-stone-400">পূজা, নোটিশ ও ইভেন্ট আপডেট পান</span>
            </span>
            <Switch
              checked={pushOn}
              disabled={pushBusy}
              onCheckedChange={(v) => void togglePush(v)}
              aria-label="Toggle push notifications"
            />
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 p-3.5 text-left shadow-sm transition hover:bg-red-50 active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <LogOut className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-red-700">Log Out</span>
              <span className="block truncate text-[11px] text-red-400">অ্যাকাউন্ট থেকে বেরিয়ে যান</span>
            </span>
          </button>

          {user?.role !== 'ADMIN' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 text-left shadow-sm transition hover:bg-stone-50 active:scale-[0.99]"
                  aria-label="Delete Account"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                    <Trash2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-stone-700">Delete Account</span>
                    <span className="block truncate text-[11px] text-stone-400">অ্যাকাউন্ট ও ব্যক্তিগত তথ্য মুছে ফেলুন</span>
                  </span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                  <AlertDialogDescription>
                    অ্যাকাউন্ট ডিলিট করলে আপনার সদস্য / টুর্নামেন্ট / শিশুতোষ বিভাগ / রক্তদান রিকোয়েস্ট এবং ব্যক্তিগত তথ্য স্থায়ীভাবে মুছে যাবে।
                    ডোনেশনের আর্থিক রেকর্ড ক্লাবের হিসাবের জন্য থেকে যাবে (নাম-তথ্য মুছে)।
                    পরে আবার যোগ দিতে চাইলে নতুন করে Sign Up করতে হবে। এটি ফেরানো যাবে না।
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>না, থাক</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleting}
                    onClick={(e) => {
                      e.preventDefault()
                      void deleteAccount()
                    }}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    {deleting ? 'মুছে ফেলা হচ্ছে…' : 'হ্যাঁ, Delete করুন'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <p className="pb-2 text-center text-[10px] text-stone-400">© 2025 B.A.S Sangha • v2.0</p>
      </main>
    </MainShell>
  )
}
