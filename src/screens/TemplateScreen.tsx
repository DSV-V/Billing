import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { unwrap, useLoad } from '../lib/useLoad';
import { errorMessage } from '../lib/errors';
import { money, qty } from '../lib/format';
import type { Nav, Role, TemplateRow } from '../lib/types';
import { Empty, ErrorBlock, Loading, Notice } from '../components/ui';
import { PositionModal, initialFromTemplate, type PositionInitial } from './PositionForm';

interface Props {
  clientId: number;
  role: Role;
  onNav: (n: Nav) => void;
}

export default function TemplateScreen({ clientId, role, onNav }: Props) {
  const [editing, setEditing] = useState<PositionInitial | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useLoad(async () => {
    const [clientRes, tplRes] = await Promise.all([
      supabase.from('v_clients').select('id,name').eq('id', clientId).maybeSingle(),
      supabase.rpc('get_template', { p_client_id: clientId }),
    ]);
    return {
      client: unwrap(clientRes) as { id: number; name: string } | null,
      items: (unwrap(tplRes) ?? []) as TemplateRow[],
    };
  }, [clientId]);

  // Klient widzi szablon tylko do odczytu.
  const canEdit = role !== 'client';

  async function remove(t: TemplateRow) {
    if (!window.confirm('Usunąć pozycję z szablonu?')) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('delete_template_position', { p_template_id: t.id });
    setBusy(false);
    if (err) setError(errorMessage(err));
    load.reload();
  }

  if (load.loading) return <Loading />;
  if (load.error) return <ErrorBlock message={errorMessage(load.error)} onRetry={load.reload} />;
  const d = load.data;
  if (!d) return null;
  if (!d.client) return <Notice>Nie znaleziono klienta</Notice>;

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <button className="btn-link" onClick={() => onNav({ name: 'client', clientId })}>← Faktury klienta</button>
          <h1>Szablon: {d.client.name}</h1>
          <span className="muted">Pozycje szablonu trafiają do nowych faktur. Zmiana szablonu nie zmienia faktur, które już istnieją.</span>
        </div>
        {canEdit && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={busy}>Dodaj pozycję</button>
          </div>
        )}
      </div>

      {error && <Notice>{error}</Notice>}

      {d.items.length === 0 ? (
        <Empty>Brak pozycji w szablonie</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Kategoria</th>
                <th className="num">Ilość</th>
                <th className="num">Cena</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {d.items.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.category}</td>
                  <td className="num">
                    {t.quantity_mode === 'register'
                      ? 'Z rejestru'
                      : t.quantity_mode === 'percent'
                        ? `${qty(t.manual_quantity)}%`
                        : qty(t.manual_quantity)}
                  </td>
                  <td className="num">
                    {t.quantity_mode === 'percent' || t.price === null
                      ? '—'
                      : `${money(t.price)} ${t.price_currency ?? ''}`}
                  </td>
                  {canEdit && (
                    <td className="row-actions">
                      <button className="btn-link" onClick={() => setEditing(initialFromTemplate(t))}>Edytuj</button>
                      <button className="btn-link danger" onClick={() => remove(t)}>Usuń</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PositionModal
          ctx={{ kind: 'template', clientId }}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load.reload();
          }}
        />
      )}
    </section>
  );
}
