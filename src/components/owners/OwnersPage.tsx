import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  listOwners, createOwner, deleteOwner, getVehicles, type OwnerInput,
} from '../../api/client';
import type { VehicleType } from '../../types/telemetry';
import s from './OwnersPage.module.css';

const EMPTY: OwnerInput = { name: '', mobile: '', purchase_date: '', vehicle_type: '2W', vehicleno: '' };

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function OwnersPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: owners = [] } = useQuery({ queryKey: ['owners'], queryFn: listOwners });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: getVehicles, refetchInterval: 5000 });

  const [form, setForm] = useState<OwnerInput>(EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const mappedIds = new Set(owners.map(o => o.vehicleno));
  const vehicleIds = [...vehicles].map(v => v.vehicleno).sort();

  const createM = useMutation({
    mutationFn: () => createOwner(form),
    onSuccess: (o) => {
      setMsg({ ok: true, text: `Mapped ${o.name} → ${o.vehicleno}.` });
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ['owners'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteOwner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owners'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });

  function set<K extends keyof OwnerInput>(key: K, value: OwnerInput[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    createM.mutate();
  }

  return (
    <div className={s.root}>
      <h1 className={s.title}>Bike Owners</h1>
      <p className={s.subtitle}>Register a customer and map them to their FLX IoT device.</p>

      <div className={s.grid}>
        {/* Registered owners */}
        <section className={s.card}>
          <h2 className={s.cardTitle}>Registered Owners ({owners.length})</h2>
          {owners.length === 0 ? (
            <div className={s.empty}>No owners yet. Register one on the right.</div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Owner</th>
                  <th scope="col">Mobile</th>
                  <th scope="col">Purchase</th>
                  <th scope="col">Type</th>
                  <th scope="col">Device</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {owners.map(o => (
                  <tr key={o.id}>
                    <td className={s.name}>{o.name}</td>
                    <td className={s.mono}>{o.mobile}</td>
                    <td>{fmtDate(o.purchase_date)}</td>
                    <td><span className={s.typeBadge}>{o.vehicle_type}</span></td>
                    <td>
                      <button className={s.deviceLink} onClick={() => navigate(`/bike/${o.vehicleno}`)}>
                        {o.vehicleno}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={s.deleteBtn}
                        onClick={() => { if (confirm(`Remove mapping for ${o.name}?`)) deleteM.mutate(o.id); }}
                      >
                        Unmap
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Register / map form */}
        <section className={s.card}>
          <h2 className={s.cardTitle}>Register Owner</h2>
          {msg && <div className={`${s.msg} ${msg.ok ? s.msgOk : s.msgError}`} role="alert">{msg.text}</div>}
          <form onSubmit={onSubmit}>
            <div className={s.field}>
              <label className={s.label} htmlFor="o-name">Name</label>
              <input id="o-name" className={s.input} value={form.name}
                onChange={e => set('name', e.target.value)} autoComplete="off" required />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="o-mobile">Mobile Number</label>
              <input id="o-mobile" className={s.input} type="tel" value={form.mobile}
                onChange={e => set('mobile', e.target.value)} placeholder="+91 98765 43210" required />
            </div>
            <div className={s.row2}>
              <div className={s.field}>
                <label className={s.label} htmlFor="o-date">Purchase Date</label>
                <input id="o-date" className={s.input} type="date" value={form.purchase_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => set('purchase_date', e.target.value)} required />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="o-type">Vehicle Type</label>
                <select id="o-type" className={s.select} value={form.vehicle_type}
                  onChange={e => set('vehicle_type', e.target.value as VehicleType)}>
                  <option value="2W">2W</option>
                  <option value="3W">3W</option>
                </select>
              </div>
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="o-vehicle">Map to Device</label>
              <select id="o-vehicle" className={s.select} value={form.vehicleno}
                onChange={e => set('vehicleno', e.target.value)} required>
                <option value="" disabled>Select a FLX device…</option>
                {vehicleIds.map(id => (
                  <option key={id} value={id} disabled={mappedIds.has(id)}>
                    {id}{mappedIds.has(id) ? ' — already mapped' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button className={s.submit} type="submit" disabled={createM.isPending}>
              {createM.isPending ? 'Saving…' : 'Register & map'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
