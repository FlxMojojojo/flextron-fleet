import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { forgotPassword } from '../../api/client';
import { BrandMark } from '../shared/BrandMark';
import s from './LoginPage.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      const r = await forgotPassword(identifier);
      setInfo(r.message ?? 'If an account exists, a reset link has been sent to its email.');
    } catch (err) {
      setError((err as Error).message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.root}>
      <form className={s.card} onSubmit={mode === 'login' ? onSubmit : onForgot}>
        <div className={s.brand}>
          <BrandMark size={44} />
          <div>
            <div className={s.title}>FLEXTRON</div>
            <div className={s.subtitle}>Fleet Telemetry · {mode === 'login' ? 'Sign in' : 'Reset password'}</div>
          </div>
        </div>

        {error && <div className={s.error} role="alert">{error}</div>}
        {info && <div className={s.info} role="status">{info}</div>}

        {mode === 'login' ? (
          <div className={s.form}>
            <div className={s.field}>
              <label className={s.label} htmlFor="username">Username</label>
              <input id="username" className={s.input} value={username}
                onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="password">Password</label>
              <input id="password" type="password" className={s.input} value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            <button className={s.button} type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button type="button" className={s.linkBtn} onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}>
              Forgot password?
            </button>
          </div>
        ) : (
          <div className={s.form}>
            <div className={s.field}>
              <label className={s.label} htmlFor="identifier">Email or username</label>
              <input id="identifier" className={s.input} value={identifier}
                onChange={e => setIdentifier(e.target.value)} autoComplete="username" autoFocus required
                placeholder="you@flextronev.com" />
            </div>
            <button className={s.button} type="submit" disabled={busy || !identifier}>
              {busy ? 'Sending…' : 'Email me a reset link'}
            </button>
            <button type="button" className={s.linkBtn} onClick={() => { setMode('login'); setError(''); setInfo(''); }}>
              ← Back to sign in
            </button>
          </div>
        )}

        <p className={s.hint}>
          {mode === 'login'
            ? 'Contact your fleet administrator for access.'
            : "We'll email a reset link to the address on your account (valid 1 hour)."}
        </p>
      </form>
    </div>
  );
}
