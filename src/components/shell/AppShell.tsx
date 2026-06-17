import { NavLink, Outlet } from 'react-router-dom';
import { BrandLockup } from '../shared/BrandMark';
import { useAuth } from '../../auth/AuthContext';
import s from './AppShell.module.css';

export function AppShell() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className={s.shell}>
      <header className={s.topbar} role="banner">
        <NavLink to="/" className={s.brand} aria-label="Flextron Fleet Telemetry home">
          <BrandLockup tone="light" tagline="Fleet Telemetry" markSize={30} />
        </NavLink>

        <nav className={s.nav} aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => `${s.navLink}${isActive ? ' ' + s.active : ''}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" />
              <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" />
              <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" />
            </svg>
            Fleet
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => `${s.navLink}${isActive ? ' ' + s.active : ''}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1L13 12H1L7 1Z" stroke="currentColor" strokeWidth="1.4" fill="none" />
              <path d="M7 5V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="7" cy="10" r="0.7" fill="currentColor" />
            </svg>
            Alerts
          </NavLink>
          <NavLink to="/owners" className={({ isActive }) => `${s.navLink}${isActive ? ' ' + s.active : ''}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="4" r="2.4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2 12.5C2 9.7 4.2 8 7 8s5 1.7 5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Owners
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin/users" className={({ isActive }) => `${s.navLink}${isActive ? ' ' + s.active : ''}`}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Users
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin/logs" className={({ isActive }) => `${s.navLink}${isActive ? ' ' + s.active : ''}`}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 3h10M2 7h10M2 11h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Logs
            </NavLink>
          )}
        </nav>

        <div className={s.liveIndicator} aria-live="polite" aria-label="Live data connected">
          <span className={s.liveDot} aria-hidden="true" />
          Connected
        </div>

        <div className={s.userArea}>
          <div className={s.userInfo}>
            <span className={s.userName}>{user?.username}</span>
            <span className={s.userRole}>{user?.role}</span>
          </div>
          <button className={s.logoutBtn} onClick={logout} aria-label="Sign out" title="Sign out">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M6 13H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M9.5 10.5L12.5 7.5L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12.5 7.5H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <main className={s.body} id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
