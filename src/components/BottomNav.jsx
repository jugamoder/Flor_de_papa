import { Link, useLocation } from 'react-router-dom';
import { Home, TrendingUp, Wallet, FileText } from 'lucide-react';
import { useUser } from '../context/UserContext';

const links = [
  { to: '/',           label: 'Inicio',     icon: Home },
  { to: '/dashboard',  label: 'Finanzas',   icon: TrendingUp },
  { to: '/caja-chica', label: 'Caja Chica', icon: Wallet },
  { to: '/reportes',   label: 'Reportes',   icon: FileText },
];

export default function BottomNav() {
  const location = useLocation();
  const { currentUser } = useUser();

  const filteredLinks = links.filter(link => {
    if (link.to === '/dashboard' && currentUser?.rol === 'Trabajador') {
      return false;
    }
    return true;
  });

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-end px-2 pt-2 pb-safe"
      style={{
        background: 'var(--nav-bg)',
        borderTop: '1px solid var(--nav-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
      }}
    >
      {filteredLinks.map((link) => {
        const Icon = link.icon;
        const isActive = location.pathname === link.to;

        return (
          <Link
            key={link.to}
            to={link.to}
            className="relative flex flex-col items-center justify-end pb-1 px-3 pt-2 rounded-xl transition-all"
            style={{ minWidth: 52 }}
          >
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                style={{ background: 'linear-gradient(90deg, #3B82F6, #60A5FA)' }}
              />
            )}
            <Icon
              size={21}
              className="transition-all"
              strokeWidth={isActive ? 2.5 : 1.8}
              style={{ color: isActive ? '#60A5FA' : 'var(--text-tertiary)' }}
            />
            <span
              className="text-[9px] font-bold mt-1 tracking-wide transition-all"
              style={{
                color: isActive ? '#93C5FD' : 'var(--text-tertiary)',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
