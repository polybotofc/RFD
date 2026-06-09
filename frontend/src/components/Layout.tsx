'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { classNames } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Home', href: '/', icon: '🏠' },
  { name: 'Discover', href: '/discover', icon: '🔍' },
  { name: 'Servers', href: '/servers', icon: '🖥️' },
  { name: 'Admin', href: '/admin', icon: '⚙️', adminOnly: true },
];

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-roblox-darker border-r border-white/10 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-roblox-accent rounded-lg flex items-center justify-center">
              <span className="text-xl">🎮</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">RFD Platform</h1>
              <p className="text-xs text-gray-400">Roblox Freedom Distribution</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={classNames(
                  'sidebar-link',
                  pathname === item.href && 'active'
                )}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-4 py-2 bg-roblox-primary rounded-lg">
                <div className="w-8 h-8 bg-roblox-accent rounded-full flex items-center justify-center text-sm font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.username}</p>
                  <p className="text-xs text-gray-400">
                    {user.is_admin ? 'Administrator' : 'Player'}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full btn-ghost text-sm"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/login" className="block btn-secondary text-center text-sm">
                Sign In
              </Link>
              <Link href="/register" className="block btn-primary text-center text-sm">
                Register
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}