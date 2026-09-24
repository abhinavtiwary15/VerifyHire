'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/auth-store'
import {
  LayoutDashboard, Users, Search, Video, Globe,
  FileText, Settings, CreditCard, LogOut, Shield, ChevronRight
} from 'lucide-react'

const NAV = [
  { group: 'Core', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/candidates', label: 'Candidates', icon: Users, badge: 'flagged' },
    { href: '/dashboard/analyze', label: 'Analyze Resume', icon: Search },
    { href: '/interview', label: 'Live Interview', icon: Video },
  ]},
  { group: 'Intelligence', items: [
    { href: '/network', label: 'Fraud Network', icon: Globe },
    { href: '/reports', label: 'Reports', icon: FileText },
  ]},
  { group: 'Settings', items: [
    { href: '/settings/integrations', label: 'Integrations', icon: Settings },
    { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  ]},
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, organization, clearAuth, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated()) router.push('/auth/login')
  }, [isAuthenticated, router])

  function logout() {
    clearAuth()
    router.push('/auth/login')
  }

  const planColors: Record<string, string> = {
    SMB: 'text-zinc-400',
    GROWTH: 'text-indigo-400',
    ENTERPRISE: 'text-purple-400',
  }

  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 min-w-56 bg-[#111114] border-r border-zinc-800 flex flex-col overflow-y-auto">
        {/* Logo */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-xs">VH</div>
            <div>
              <div className="font-bold text-white text-sm leading-none">VerifyHire</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> FRAUD DETECTION
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {NAV.map((group) => (
            <div key={group.group} className="mb-1">
              <div className="px-3 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
                {group.group}
              </div>
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 mx-1 px-3 py-2 rounded-lg text-sm transition-all ${
                      active
                        ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge === 'flagged' && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
                    )}
                    {active && <ChevronRight className="w-3 h-3 opacity-50" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Org footer */}
        <div className="p-3 border-t border-zinc-800">
          <div className="bg-zinc-900 rounded-xl p-2.5 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {organization?.name?.slice(0, 2).toUpperCase() || 'AC'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{organization?.name || 'Acme Corp'}</div>
                <div className={`text-[10px] ${planColors[organization?.plan || 'GROWTH']}`}>
                  {organization?.plan || 'Growth'} · {organization?.screeningsUsed || 0}/{organization?.screeningLimit || 50}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out ({user?.email?.split('@')[0]})
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
