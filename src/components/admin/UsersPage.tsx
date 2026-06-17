import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, deleteUser, type Role } from '../../api/client';
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
  const [role, setRole] = useState<Role>('user');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const createM = useMutation({
    mutationFn: () => createUser(username, password, role),
    onSuccess: (u) => {
      setMsg({ ok: true, text: `Created ${u.role} "${u.username}".` });
      setUsername(''); setPassword(''); setRole('user');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });

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
                  <td>
                    <span className={`${s.roleBadge} ${u.role === 'admin' ? s.roleAdmin : s.roleUser}`}>{u.role}</span>
                  </td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
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
