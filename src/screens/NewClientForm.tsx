import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { unwrap, useLoad } from '../lib/useLoad';
import { errorMessage } from '../lib/errors';
import type { AdminRow, CurrencyRow, Role } from '../lib/types';
import { Loading, Modal, Notice, ErrorBlock } from '../components/ui';

interface Props {
  role: Role;
  userId: number | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}

export function NewClientForm({ role, userId, onClose, onCreated }: Props) {
  const meta = useLoad(async () => {
    const curRes = await supabase.from('nbp_currencies').select('code,name').order('code');
    const adminsRes = role === 'creator' ? await supabase.rpc('list_admins') : null;
    return {
      currencies: (unwrap(curRes) ?? []) as CurrencyRow[],
      admins: adminsRes ? ((unwrap(adminsRes) ?? []) as AdminRow[]) : [],
    };
  }, [role]);

  return (
    <Modal title="Nowy klient" onClose={onClose}>
      {meta.loading && <Loading />}
      {meta.error != null && <ErrorBlock message={errorMessage(meta.error)} onRetry={meta.reload} />}
      {meta.data && (
        <FormBody
          currencies={meta.data.currencies}
          admins={meta.data.admins}
          role={role}
          userId={userId}
          onClose={onClose}
          onCreated={onCreated}
        />
      )}
    </Modal>
  );
}

interface BodyProps {
  currencies: CurrencyRow[];
  admins: AdminRow[];
  role: Role;
  userId: number | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}

function FormBody({ currencies, admins, role, userId, onClose, onCreated }: BodyProps) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('');
  // Администратор создаёт клиента только для себя: список фиксирован его идентификатором.
  const [selected, setSelected] = useState<number[]>(role === 'admin' && userId ? [userId] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Podaj nazwę');
      return;
    }
    if (!currency) {
      setError('Wybierz walutę faktury');
      return;
    }
    if (selected.length === 0) {
      setError('Wybierz administratora');
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase.rpc('create_client', {
      p_name: name.trim(),
      p_currency: currency,
      p_admin_user_ids: selected,
    });
    setBusy(false);
    if (err) setError(errorMessage(err));
    else onCreated(data as number);
  }

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Nazwa klienta
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label>
        Waluta faktury
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} required>
          <option value="">— wybierz —</option>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
          ))}
        </select>
      </label>

      <fieldset className="fieldset">
        <legend>Administratorzy</legend>
        {role === 'admin' ? (
          <span className="muted">Będziesz przypisany jako administrator tego klienta.</span>
        ) : admins.length === 0 ? (
          <span className="muted">Brak administratorów do wyboru.</span>
        ) : (
          admins.map((a) => (
            <label key={a.id} className="check">
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
              {a.name}
            </label>
          ))
        )}
      </fieldset>

      {error && <Notice>{error}</Notice>}

      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" disabled={busy}>Zapisz</button>
      </div>
    </form>
  );
}
