import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { unwrap, useLoad } from '../lib/useLoad';
import { errorMessage } from '../lib/errors';
import { currentPeriod, money, monthLabel, monthsAround } from '../lib/format';
import type { ClientRow, InvoiceRow, Nav, Role } from '../lib/types';
import { Empty, ErrorBlock, Loading, Notice, StatusBadge } from '../components/ui';

interface Props {
  clientId: number;
  role: Role;
  onNav: (n: Nav) => void;
}

export default function ClientInvoicesScreen({ clientId, role, onNav }: Props) {
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useLoad(async () => {
    const [clientRes, invRes] = await Promise.all([
      supabase.from('v_clients').select('id,name,invoice_currency,admins').eq('id', clientId).maybeSingle(),
      supabase.from('v_invoices').select('*').eq('client_id', clientId).order('period_month', { ascending: false }),
    ]);
    return {
      client: unwrap(clientRes) as ClientRow | null,
      invoices: (unwrap(invRes) ?? []) as InvoiceRow[],
    };
  }, [clientId]);

  const d = load.data;

  // Месяцы для открытия: 6 месяцев назад и 6 вперёд. Месяцы, за которые счёт уже есть, не предлагаем.
  // Список счетов ниже показывает все открытые и закрытые счета без ограничений.
  const options = useMemo(() => {
    if (!d) return [];
    const taken = new Set(d.invoices.map((i) => i.period_month.slice(0, 10)));
    return monthsAround(currentPeriod(), 6, 6).filter((p) => !taken.has(p));
  }, [d]);

  const current = currentPeriod();
  const selected =
    period && options.includes(period) ? period : options.includes(current) ? current : options[0] ?? '';
  const canEdit = role !== 'client';

  async function openMonth() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('open_month', { p_client_id: clientId, p_period: selected });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      load.reload();
      return;
    }
    onNav({ name: 'invoice', clientId, invoiceId: data as number });
  }

  if (load.loading) return <Loading />;
  if (load.error) return <ErrorBlock message={errorMessage(load.error)} onRetry={load.reload} />;
  if (!d) return null;

  if (!d.client) {
    return (
      <section className="stack">
        <Notice>Nie znaleziono klienta</Notice>
      </section>
    );
  }

  const client = d.client;

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          {role !== 'client' && (
            <button className="btn-link" onClick={() => onNav({ name: 'clients' })}>← Klienci</button>
          )}
          <h1>{client.name}</h1>
          <span className="muted">Waluta faktury: {client.invoice_currency}</span>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => onNav({ name: 'template', clientId })}>Szablon</button>
          <button className="btn" onClick={() => onNav({ name: 'registers', clientId })}>Rejestry</button>
        </div>
      </div>

      {canEdit && options.length > 0 && (
        <div className="open-month">
          <select value={selected} onChange={(e) => setPeriod(e.target.value)} aria-label="Miesiąc">
            {options.map((p) => (
              <option key={p} value={p}>{monthLabel(p)}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={openMonth} disabled={busy || !selected}>
            Otwórz fakturę na {selected ? monthLabel(selected) : '—'}
          </button>
        </div>
      )}

      {error && <Notice>{error}</Notice>}

      {d.invoices.length === 0 && <Empty>Brak faktur</Empty>}

      <ul className="cards">
        {d.invoices.map((inv) => {
          const noAmount = inv.rate_missing || inv.total_amount === null;
          const amount = noAmount ? 'Kurs niedostępny' : `${money(inv.total_amount)} ${inv.invoice_currency}`;
          return (
            <li key={inv.id}>
              <button className="card" onClick={() => onNav({ name: 'invoice', clientId, invoiceId: inv.id })}>
                <strong>{monthLabel(inv.period_month)}</strong>
                <StatusBadge tone={inv.status === 'open' ? 'open' : 'closed'}>
                  {inv.status === 'open' ? 'Otwarta' : 'Zamknięta'}
                </StatusBadge>
                <span className="amount">{amount}</span>
                {inv.rate_missing && <StatusBadge tone="warn">Brak kursu</StatusBadge>}
                {inv.is_stale && !inv.rate_missing && <StatusBadge tone="warn">Kurs nieaktualny</StatusBadge>}
              </button>
            </li>
          );
        })}
      </ul>

    </section>
  );
}
