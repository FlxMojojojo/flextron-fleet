import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, deleteUser, setUserPassword, setUserEmail, type Role } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import s from './UsersPage.module.css';

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const createM = useMutation({
    mutationFn: () => createUser(username, password, role, email),
    onSuccess: (u) => {
      setMsg({ ok: true, text: `Created ${u.role} "${u.username}".` });
      setUsername(''); setPassword(''); setEmail(''); setRole('user');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });

  const emailM = useMutation({
    mutationFn: ({ id, e }: { id: string; e: string }) => setUserEmail(id, e),
    onSuccess: () => { setMsg({ ok: true, text: 'Email updated.' }); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });

  function onSetEmail(id: string, username: string, current?: string) {
    const e = window.prompt(`Email address for "${username}" (used for password reset):`, current ?? '');
    if (e == null) return;
    setMsg(null);
    emailM.mutate({ id, e });
  }

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });

  const resetPwM = useMutation({
    mutationFn: ({ id, pw }: { id: string; pw: string }) => setUserPassword(id, pw),
    onSuccess: () => setMsg({ ok: true, text: 'Password updated.' }),
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });

  function onResetPassword(id: string, username: string) {
    const pw = window.prompt(`Set a new password for "${username}" (min 6 characters):`);
    if (pw == null) return;
    if (pw.length < 6) { setMsg({ ok: false, text: 'Password must be at least 6 characters.' }); return; }
    setMsg(null);
    resetPwM.mutate({ id, pw });
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    createM.mutate();
  }

  return (
    <div className={s.root}>
      <h1 className={s.title}>User Management</h1>

      <div className={s.grid}>
        {/* Existing users */}
        <section className={s.card}>
          <h2 className={s.cardTitle}>Accounts ({users.length})</h2>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Username</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Created</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className={s.username}>
                    {u.username}{u.id === me?.id && <span style={{ color: '#94A3B8', fontWeight: 400 }}> (you)</span>}
                  </td>
                  <td className={s.email}>
                    {u.email
                      ? <button className={s.emailLink} onClick={() => onSetEmail(u.id, u.username, u.email)}>{u.email}</button>
                      : <button className={s.emailAdd} onClick={() => onSetEmail(u.id, u.username)}>+ add email</button>}
                  </td>
                  <td>
                    <span className={`${s.roleBadge} ${u.role === 'admin' ? s.roleAdmin : s.roleUser}`}>{u.role}</span>
                  </td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={s.actions}>
                      <button
                        className={s.resetBtn}
                        onClick={() => onResetPassword(u.id, u.username)}
                        disabled={resetPwM.isPending}
                        title="Set a new password for this user"
                      >
                        Reset password
                      </button>
                      <button
                        className={s.deleteBtn}
                        onClick={() => {
                          if (confirm(`Delete user "${u.username}"?`)) deleteM.mutate(u.id);
                        }}
                        disabled={u.id === me?.id}
                        title={u.id === me?.id ? 'You cannot delete your own account' : 'Delete user'}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Create user */}
        <section className={s.card}>
          <h2 className={s.cardTitle}>Create User</h2>
          {msg && <div className={`${s.msg} ${msg.ok ? s.msgOk : s.msgError}`} role="alert">{msg.text}</div>}
          <form onSubmit={onCreate}>
            <div className={s.field}>
              <label className={s.label} htmlFor="nu">Username</label>
              <input id="nu" className={s.input} value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" required />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="np">Password</label>
              <input id="np" className={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="ne">Email <span style={{ textTransform: 'none', color: '#94A3B8' }}>(for password reset)</span></label>
              <input id="ne" className={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" placeholder="user@flextronev.com" />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="nr">Role</label>
              <select id="nr" className={s.select} value={role} onChange={e => setRole(e.target.value as Role)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className={s.submit} type="submit" disabled={createM.isPending}>
              {createM.isPending ? 'Creating…' : 'Create user'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
