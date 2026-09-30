import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import {
  HomeIcon,
  CalendarIcon,
  CameraIcon,
  PlusIcon,
  LogOutIcon,
  HeadphonesIcon,
  SunIcon,
  MoonIcon,
} from './icons/Icons';

export default function Layout() {
  const { signOut } = useAuth();
  const [theme, setThemeState] = useState<Theme>(getTheme());

  const handleSignOut = async () => {
    // Clearing auth state (via signOut) causes App to unmount the router
    // and render the Login screen directly — there is no routed /login path.
    await signOut();
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(setTheme(next));
  };

  const navItems = [
    { to: '/', icon: HomeIcon, label: 'Home' },
    { to: '/events', icon: CalendarIcon, label: 'Events' },
    { to: '/scan', icon: CameraIcon, label: 'Scan' },
    { to: '/add', icon: PlusIcon, label: 'Add' },
  ];

  const themeToggle = (labelClass = '') => (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`btn-ghost !p-2 items-center ${labelClass}`}
    >
      {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </button>
  );

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-border-subtle bg-surface-1/80 px-4 py-5">
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
            <HeadphonesIcon size={16} className="text-accent" />
          </div>
          <span className="text-base font-bold tracking-tight text-text-primary">DJ Ops</span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center justify-between px-2 pt-4 border-t border-border-subtle">
          {themeToggle()}
          <button onClick={handleSignOut} className="btn-ghost !p-2" aria-label="Sign out">
            <LogOutIcon size={18} />
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 md:ml-60">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-50 glass border-b border-border-subtle">
          <div className="flex items-center justify-between max-w-lg mx-auto px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                <HeadphonesIcon size={16} className="text-accent" />
              </div>
              <span className="text-base font-bold tracking-tight text-text-primary">
                DJ Ops
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {themeToggle()}
              <button onClick={handleSignOut} className="btn-ghost !p-2" aria-label="Sign out">
                <LogOutIcon size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Content: phone-width on mobile, wide on desktop */}
        <main className="max-w-lg md:max-w-5xl mx-auto px-4 md:px-8 py-5 md:py-8 animate-fade-in">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-border-subtle">
          <div className="max-w-lg mx-auto flex">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}