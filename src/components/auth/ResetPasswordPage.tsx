import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../api/client';
import { BrandMark } from '../shared/BrandMark';
import s from './LoginPage.module.css';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (pw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await resetPassword(token, pw);
      setDone(true);
    } catch (err) {
      setError((err as Error).message || 'Reset failed');
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
            <div className={s.subtitle}>Fleet Telemetry · Set new password</div>
          </div>
        </div>

        {!token && <div className={s.error}>Missing or invalid reset link.</div>}
        {error && <div className={s.error} role="alert">{error}</div>}

        {done ? (
          <>
            <div className={s.info} role="status">Password updated. You can now sign in with your new password.</div>
            <button className={s.button} type="button" onClick={() => navigate('/login')}>Go to sign in</button>
          </>
        ) : (
          <div className={s.form}>
            <div className={s.field}>
              <label className={s.label} htmlFor="np">New password</label>
              <input id="np" type="password" className={s.input} value={pw}
                onChange={e => setPw(e.target.value)} autoComplete="new-password" minLength={6} autoFocus required />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="np2">Confirm password</label>
              <input id="np2" type="password" className={s.input} value={pw2}
                onChange={e => setPw2(e.target.value)} autoComplete="new-password" minLength={6} required />
            </div>
            <button className={s.button} type="submit" disabled={busy || !token}>
              {busy ? 'Updating…' : 'Set new password'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
