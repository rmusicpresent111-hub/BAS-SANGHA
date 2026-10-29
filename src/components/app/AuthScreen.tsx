'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react'
import { useApp } from '@/lib/store'
import { apiFetch, setToken } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type Mode = 'login' | 'signup' | 'forgot'

const PARTICLES = 10

export default function AuthScreen() {
  const { setUser, setView } = useApp()
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [phone, setPhone] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const switchMode = (m: Mode) => {
    setMode(m)
    setPassword('')
    setResetCode('')
    setPhone('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      if (data.token) setToken(data.token)
      setUser(data.user)
      toast({ title: `Welcome back, ${data.user.name}!` })
      setView(data.user.role === 'ADMIN' ? 'admin' : 'home')
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Login failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return
    }
    if (password.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sign up failed')
      if (data.token) setToken(data.token)
      setUser(data.user)
      toast({ title: 'Account created successfully!' })
      setView('home')
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Sign up failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return
    }
    if (password.length < 6) {
      toast({ title: 'New password must be at least 6 characters', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword: password, resetCode, phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      toast({ title: 'Password reset successful. Please login.' })
      switchMode('login')
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Reset failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const particles = [
    { left: 8, top: 22, size: 4, delay: 0 },
    { left: 88, top: 16, size: 5, delay: 1.2 },
    { left: 15, top: 68, size: 3, delay: 2.1 },
    { left: 92, top: 58, size: 4, delay: 0.6 },
    { left: 5, top: 45, size: 3, delay: 1.8 },
    { left: 78, top: 82, size: 4, delay: 2.6 },
    { left: 25, top: 8, size: 3, delay: 0.9 },
    { left: 60, top: 90, size: 3, delay: 1.5 },
    { left: 95, top: 35, size: 3, delay: 2.9 },
    { left: 40, top: 5, size: 4, delay: 2.3 },
  ]

  const inputCls =
    'h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/25'
  const labelCls = 'flex items-center gap-2 text-sm font-semibold text-amber-200/90'
  const btnCls =
    'h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 text-base font-bold text-white shadow-[0_10px_30px_rgba(234,88,12,0.4)] transition-all hover:brightness-110 active:scale-[0.99]'

  return (
    <div className="devotional-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* faint Kali backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/images/kali-bg.png"
          alt=""
          fill
          className="object-cover object-center opacity-45"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#200606]/80 via-[#190404]/75 to-[#120303]/90" />
      </div>

      {/* floating particles */}
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute z-0 rounded-full bg-amber-300"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, boxShadow: '0 0 10px rgba(252,211,77,0.9)' }}
          animate={{ y: [0, -26, 0], opacity: [0.12, 0.85, 0.12] }}
          transition={{ duration: 4 + (i % 4), delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* top logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 mb-6 flex flex-col items-center"
      >
        <div className="relative">
          <motion.div
            animate={{ opacity: [0.35, 0.75, 0.35] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-5 rounded-full bg-amber-400/30 blur-2xl"
          />
          <div className="ring-glow relative h-20 w-20 overflow-hidden rounded-full bg-white shadow-xl">
            <Image src="/logo.png" alt="B.A.S Sangha logo" width={80} height={80} className="h-full w-full object-contain p-1" priority />
          </div>
        </div>
        <h1 className="gold-text mt-3 text-3xl font-black tracking-wide">B.A.S Sangha</h1>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.3em] text-amber-100/60">Dakshin Gobindapur · Estd 2021</p>
      </motion.div>

      {/* dark glass card */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#1c0808]/70 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-8"
      >
        {mode !== 'forgot' && (
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/40 p-1">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`relative rounded-full py-2.5 text-sm font-bold transition-colors ${
                  mode === m ? 'text-white' : 'text-amber-200/70 hover:text-amber-100'
                }`}
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-pill"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500 to-red-600 shadow-lg shadow-orange-950/60"
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  />
                )}
                <span className="relative z-10">{m === 'login' ? 'Login' : 'Sign Up'}</span>
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleLogin}
              className="space-y-4"
            >
              <h2 className="text-center text-xl font-bold text-white">Sign in to continue</h2>
              <div className="space-y-1.5">
                <Label htmlFor="email" className={labelCls}>
                  <Mail className="h-4 w-4" /> Email ID
                </Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className={labelCls}>
                  <KeyRound className="h-4 w-4" /> Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/60 hover:text-amber-200">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => switchMode('forgot')} className="flex items-center gap-1.5 text-sm font-semibold text-amber-400 hover:text-amber-300 hover:underline">
                  <KeyRound className="h-3.5 w-3.5" /> Forgot Password?
                </button>
              </div>
              <Button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </motion.form>
          )}

          {mode === 'signup' && (
            <motion.form
              key="signup"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSignup}
              className="space-y-4"
            >
              <h2 className="text-center text-xl font-bold text-white">Create your account</h2>
              <div className="space-y-1.5">
                <Label htmlFor="s-name" className={labelCls}>
                  <ShieldCheck className="h-4 w-4" /> Full Name
                </Label>
                <Input id="s-name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-email" className={labelCls}>
                  <Mail className="h-4 w-4" /> Email ID
                </Label>
                <Input id="s-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-password" className={labelCls}>
                  <KeyRound className="h-4 w-4" /> Password
                </Label>
                <div className="relative">
                  <Input
                    id="s-password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password visibility" className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/60 hover:text-amber-200">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5" /> No OTP required — sign up instantly
              </p>
              <Button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Creating account...' : 'Sign Up'}
              </Button>
            </motion.form>
          )}

          {mode === 'forgot' && (
            <motion.form
              key="forgot"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleForgot}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-400" />
                <h2 className="text-xl font-bold text-white">Reset password</h2>
              </div>
              <p className="text-center text-xs text-white/60">Enter your registered email and choose a new password. Members-কে নিজের registered mobile number-ও দিতে হবে।</p>
              <div className="space-y-1.5">
                <Label htmlFor="f-email" className={labelCls}>
                  <Mail className="h-4 w-4" /> Registered Email ID
                </Label>
                <Input id="f-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-password" className={labelCls}>
                  <KeyRound className="h-4 w-4" /> New Password
                </Label>
                <Input id="f-password" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-phone" className={labelCls}>
                  <Phone className="h-4 w-4" /> Registered Mobile Number <span className="text-xs font-normal text-amber-100/50">(members-দের জন্য)</span>
                </Label>
                <Input
                  id="f-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Member Join-এ দেওয়া 10-digit নম্বর"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-code" className={labelCls}>
                  <ShieldCheck className="h-4 w-4" /> Reset Code <span className="text-xs font-normal text-amber-100/50">(শুধু admin account হলে)</span>
                </Label>
                <Input id="f-code" placeholder="Admin reset code — members don't need it" value={resetCode} onChange={(e) => setResetCode(e.target.value)} className={inputCls} />
              </div>
              <Button type="submit" disabled={loading} className={btnCls}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
              <button type="button" onClick={() => switchMode('login')} className="w-full text-center text-xs font-semibold text-amber-400/80 hover:text-amber-300 hover:underline">
                ← Back to Login
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="relative z-10 mt-4 text-center text-[11px] text-white/40">
        Club admin? Login with your admin credentials to open the Admin Panel.
      </p>

      {/* powered by footer */}
      <p className="relative z-10 mt-5 flex items-center gap-2 text-center text-xs text-white/50">
        <Phone className="h-3.5 w-3.5" /> Powered by Dakshin Gobindapur B.A.S Sangha Committee
      </p>
    </div>
  )
}
