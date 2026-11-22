import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { unwrap, useLoad } from '../lib/useLoad';
import { errorMessage } from '../lib/errors';
import { currentPeriod } from '../lib/format';
import type { ClientRow, Nav, Role } from '../lib/types';
import { Empty, ErrorBlock, Loading, StatusBadge } from '../components/ui';
import { NewClientForm } from './NewClientForm';

interface Props {
  role: Role;
  userId: number | null;
  onNav: (n: Nav) => void;
}

export default function ClientsScreen({ role, userId, onNav }: Props) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const period = currentPeriod();

  const load = useLoad(async () => {
    const [clientsRes, invRes] = await Promise.all([
      supabase.from('v_clients').select('id,name,invoice_currency,admins').order('name'),
      supabase.from('v_invoices').select('client_id,status').eq('period_month', period),
    ]);
    const clients = (unwrap(clientsRes) ?? []) as ClientRow[];
    const invoices = (unwrap(invRes) ?? []) as { client_id: number; status: 'open' | 'closed' }[];
    return { clients, statuses: new Map(invoices.map((i) => [i.client_id, i.status])) };
  }, [period]);

  const data = load.data;

  // Клиент видит одного назначенного клиента: сразу открываем его экран.
  useEffect(() => {
    if (role === 'client' && data && data.clients.length === 1) {
      onNav({ name: 'client', clientId: data.clients[0].id });
    }
  }, [role, data, onNav]);

  if (load.loading) return <Loading />;
  if (load.error) return <ErrorBlock message={errorMessage(load.error)} onRetry={load.reload} />;
  if (!data) return null;
  if (role === 'client') return <Loading />;

  const q = query.trim().toLowerCase();
  const list = data.clients.filter((c) => c.name.toLowerCase().includes(q));

  return (
    <section className="stack">
      <div className="toolbar">
        <h1>Klienci</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>Dodaj nowego klienta</button>
      </div>

      <input
        className="search"
        placeholder="Szukaj klienta"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {data.clients.length === 0 && <Empty>Brak klientów</Empty>}

      <ul className="cards">
        {list.map((c) => {
          const status = data.statuses.get(c.id);
          return (
            <li key={c.id}>
              <button className="card" onClick={() => onNav({ name: 'client', clientId: c.id })}>
                <strong>{c.name}</strong>
                <span className="muted">Waluta faktury: {c.invoice_currency}</span>
                {role === 'creator' && (
                  <span className="muted">
                    Administratorzy: {c.admins.length ? c.admins.map((a) => a.name).join(', ') : '—'}
                  </span>
                )}
                {status && (
                  <StatusBadge tone={status === 'open' ? 'open' : 'closed'}>
                    {status === 'open' ? 'Otwarta' : 'Zamknięta'}
                  </StatusBadge>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {creating && (
        <NewClientForm
          role={role}
          userId={userId}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onNav({ name: 'client', clientId: id });
          }}
        />
      )}
    </section>
  );
}
