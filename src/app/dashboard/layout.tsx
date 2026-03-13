'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import Link from 'next/link';
import {
  LayoutDashboard,
  Upload,
  History,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  Menu,
  X,
  Moon,
  Sun,
  Bell,
  Database,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import styles from './layout.module.css';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/upload', label: 'Upload Dataset', icon: Upload },
  { href: '/dashboard/history', label: 'Dataset History', icon: History },
  { href: '/dashboard/settings', label: 'Account Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isPro, isTeam, planLimits, remainingOps } = useSubscription();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (authLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className={styles.container}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed} ${mobileMenuOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/dashboard" className={styles.logo}>
            <Database size={24} />
            {sidebarOpen && <span>DatasetCleaner</span>}
          </Link>
          <button 
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <ChevronLeft size={18} className={sidebarOpen ? '' : styles.rotated} />
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          {!isPro && (
            <Link href="/pricing" className={styles.upgradeBanner}>
              <Sparkles size={18} />
              {sidebarOpen && (
                <>
                  <span>Upgrade to Pro</span>
                  <span className={styles.badge}>SAVE</span>
                </>
              )}
            </Link>
          )}
          
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                {user.email[0].toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className={styles.userDetails}>
                  <span className={styles.userEmail}>{user.email}</span>
                  <span className={styles.userPlan}>
                    {isTeam ? 'Team Plan' : isPro ? 'Pro Plan' : 'Free Plan'}
                  </span>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className={styles.logoutButton} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className={`${styles.overlay} ${mobileMenuOpen ? styles.overlayVisible : ''}`} onClick={() => setMobileMenuOpen(false)} />

      <main className={`${styles.main} ${!sidebarOpen ? styles.mainExpanded : ''}`}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button 
              className={styles.mobileMenuButton}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className={styles.pageTitle}>
              <h1>
                {navItems.find(item => item.href === pathname)?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button className={styles.themeToggle} onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className={styles.notificationButton}>
              <Bell size={20} />
              <span className={styles.notificationDot} />
            </button>
            <div className={styles.headerStorage}>
              <Database size={16} />
              <span>{formatStorage(user.storage_used)} / {isTeam ? '500MB' : isPro ? '100MB' : '5GB'}</span>
            </div>
            <div className={styles.headerStorage}>
              <Zap size={16} />
              <span>{remainingOps === -1 ? '∞' : remainingOps} ops</span>
            </div>
          </div>
        </header>

        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}

function formatStorage(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
