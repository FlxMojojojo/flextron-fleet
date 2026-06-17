import { NavLink, Outlet } from 'react-router-dom';
import s from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={s.shell}>
      <header className={s.topbar} role="banner">
        <NavLink to="/" className={s.brand} aria-label="Flextron Fleet Telemetry home">
          <span className={s.brandMark} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12 L8 2 L14 12 H9 L8 14 L7 12 Z" fill="white" />
            </svg>
          </span>
          <span>
            <div className={s.brandName}>Flextron</div>
            <div className={s.brandSub}>Fleet Telemetry</div>
          </span>
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
        </nav>

        <div className={s.liveIndicator} aria-live="polite" aria-label="Live data connected">
          <span className={s.liveDot} aria-hidden="true" />
          Connected
        </div>
      </header>

      <main className={s.body} id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
