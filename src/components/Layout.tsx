import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  HomeIcon,
  CalendarIcon,
  CameraIcon,
  PlusIcon,
  LogOutIcon,
  HeadphonesIcon,
} from './icons/Icons';

export default function Layout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: HomeIcon, label: 'Home' },
    { to: '/events', icon: CalendarIcon, label: 'Events' },
    { to: '/scan', icon: CameraIcon, label: 'Scan' },
    { to: '/add', icon: PlusIcon, label: 'Add' },
  ];

  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="flex items-center justify-between max-w-lg mx-auto px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <HeadphonesIcon size={16} className="text-accent" />
            </div>
            <span className="text-base font-bold tracking-tight text-text-primary">
              DJ Ops
            </span>
          </div>
          <button onClick={handleSignOut} className="btn-ghost !p-2" aria-label="Sign out">
            <LogOutIcon size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 animate-fade-in">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border-subtle">
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
  );
}
