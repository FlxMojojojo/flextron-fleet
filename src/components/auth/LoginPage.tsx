import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { BrandMark } from '../shared/BrandMark';
import s from './LoginPage.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.root}>
      <form className={s.card} onSubmit={onSubmit}>
        <div className={s.brand}>
          <BrandMark size={44} />
          <div>
            <div className={s.title}>FLEXTRON</div>
            <div className={s.subtitle}>Fleet Telemetry · Sign in</div>
          </div>
        </div>

        {error && <div className={s.error} role="alert">{error}</div>}

        <div className={s.form}>
          <div className={s.field}>
            <label className={s.label} htmlFor="username">Username</label>
            <input
              id="username" className={s.input} value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username" autoFocus required
            />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="password">Password</label>
            <input
              id="password" type="password" className={s.input} value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" required
            />
          </div>
          <button className={s.button} type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <p className={s.hint}>Contact your fleet administrator for access.</p>
      </form>
    </div>
  );
}
