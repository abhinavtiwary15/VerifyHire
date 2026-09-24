'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  
  const [organizationName, setOrganizationName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const res: any = await api.register(email, password, organizationName)
      setAuth(res.data)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans text-zinc-200">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-sm">VH</div>
          <div>
            <div className="font-bold text-white text-lg leading-none">VerifyHire</div>
            <div className="text-xs text-zinc-500 mt-0.5">Hiring Fraud Detection</div>
          </div>
        </div>

        <div className="bg-[#111114] border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-xl font-semibold text-white mb-1">Create organization</h1>
          <p className="text-sm text-zinc-500 mb-6">Set up your trust layer for hiring</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                Organization Name
              </label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Corp"
                required
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-600"
              />
              <p className="text-[10px] text-zinc-500 mt-1.5 italic">Must be at least 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-600/10"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </>
              ) : 'Get Started'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4 justify-center">
            <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                <div className="w-1 h-1 rounded-full bg-green-500" /> API Status: 200 OK
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                <div className="w-1 h-1 rounded-full bg-zinc-600" /> Infrastructure: Secure
            </div>
        </div>
      </div>
    </div>
  )
}
