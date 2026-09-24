'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res: any = await api.login(email, password)
      setAuth(res.data)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-sm">VH</div>
          <div>
            <div className="font-bold text-white text-lg leading-none">VerifyHire</div>
            <div className="text-xs text-zinc-500 mt-0.5">Hiring Fraud Detection</div>
          </div>
        </div>

        <div className="bg-[#111114] border border-zinc-800 rounded-2xl p-6">
          <h1 className="text-xl font-semibold text-white mb-1">Sign in</h1>
          <p className="text-sm text-zinc-500 mb-6">Welcome back to VerifyHire</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-zinc-500">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300">
              Create one
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Demo: admin@acme.com / password123
        </p>
      </div>
    </div>
  )
}
