import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { unwrap, useLoad } from '../lib/useLoad';
import { errorMessage } from '../lib/errors';
import {
  CATEGORIES,
  type CategoryTotalRow,
  type EventRow,
  type InvoiceRow,
  type InvoiceTotalRow,
  type Nav,
  type PositionRow,
  type RateInfoRow,
  type RegisterRow,
  type Role,
} from '../lib/types';
import {
  closeAllowed,
  dateTimePl,
  money,
  monthLabel,
  qty,
  rate,
  toNum,
} from '../lib/format';
import { Empty, ErrorBlock, Loading, Modal, Notice, StatusBadge } from '../components/ui';
import { PositionModal, initialFromPosition } from './PositionForm';

interface Props {
  invoiceId: number;
  clientId: number;
  role: Role;
  onNav: (n: Nav) => void;
}

export default function InvoiceScreen({ invoiceId, clientId, role, onNav }: Props) {
  const [editing, setEditing] = useState<PositionRow | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [comment, setComment] = useState('');

  const load = useLoad(async () => {
    const [invRes, posRes, catRes, totRes, rateRes, evRes] = await Promise.all([
      supabase.from('v_invoices').select('*').eq('id', invoiceId).maybeSingle(),
      supabase.from('v_invoice_positions').select('*').eq('invoice_id', invoiceId).order('id'),
      supabase.from('v_invoice_category_totals').select('*').eq('invoice_id', invoiceId),
      supabase.from('v_invoice_totals').select('*').eq('invoice_id', invoiceId).maybeSingle(),
      supabase.rpc('invoice_rate_info', { p_invoice_id: invoiceId }),
      supabase.from('v_invoice_events').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
    ]);

    const invoice = unwrap(invRes) as InvoiceRow | null;
    let registers: RegisterRow[] = [];
    if (invoice) {
      const regRes = await supabase.rpc('registers_for_month', { p_period: invoice.period_month.slice(0, 10) });
      registers = ((unwrap(regRes) ?? []) as RegisterRow[]).filter((r) => r.client_id === invoice.client_id);
    }

    return {
      invoice,
      positions: (unwrap(posRes) ?? []) as PositionRow[],
      catTotals: (unwrap(catRes) ?? []) as CategoryTotalRow[],
      total: (unwrap(totRes) as InvoiceTotalRow | null)?.total_amount ?? null,
      rates: (unwrap(rateRes) ?? []) as RateInfoRow[],
      events: (unwrap(evRes) ?? []) as EventRow[],
      registers,
    };
  }, [invoiceId]);

  if (load.loading) return <Loading />;
  if (load.error) return <ErrorBlock message={errorMessage(load.error)} onRetry={load.reload} />;
  const d = load.data;
  if (!d) return null;
  if (!d.invoice) return <Notice>Nie znaleziono faktury</Notice>;

  const inv = d.invoice;
  const isOpen = inv.status === 'open';
  const isClosed = inv.status === 'closed';
  const canEdit = isOpen && role !== 'client';
  const canClose = canEdit && !inv.rate_missing && closeAllowed(inv.period_month);
  const amountHidden = inv.rate_missing || d.total === null;
  const invCur = inv.invoice_currency;

  // Итог категории: NULL — курса нет; нет строки, но позиции есть — тоже курса нет; пустая категория — 0.
  // Константа data уже без null: вложенная функция не наследует проверку `if (!d)`, поэтому берём её явно.
  const data = d;
  function categoryTotal(cat: string): string {
    const row = data.catTotals.find((c) => c.category === cat);
    const hasPositions = data.positions.some((p) => p.category === cat);
    if (row) return money(row.total_amount) ?? 'Kurs niedostępny';
    if (hasPositions) return 'Kurs niedostępny';
    return money(0) ?? '0,00';
  }

  function registerNotFilled(p: PositionRow): boolean {
    if (p.quantity_mode !== 'register' || !p.register_name) return false;
    const reg = data.registers.find((r) => r.register_name === p.register_name);
    return reg ? !reg.is_filled : false;
  }

  async function closeInvoice() {
    setBusy(true);
    setActionError(null);
    const { error } = await supabase.rpc('close_invoice', { p_invoice_id: invoiceId });
    setBusy(false);
    if (error) setActionError(errorMessage(error));
    load.reload();
  }

  async function reopenInvoice() {
    const text = comment.trim();
    if (!text) return;
    setBusy(true);
    setActionError(null);
    const { error } = await supabase.rpc('reopen_invoice', { p_invoice_id: invoiceId, p_comment: text });
    setBusy(false);
    if (error) {
      setActionError(errorMessage(error));
    } else {
      setReopening(false);
      setComment('');
    }
    load.reload();
  }

  async function deletePosition(p: PositionRow) {
    if (!window.confirm('Usunąć pozycję?')) return;
    setBusy(true);
    setActionError(null);
    const { error } = await supabase.rpc('delete_position', { p_position_id: p.id });
    setBusy(false);
    if (error) setActionError(errorMessage(error));
    load.reload();
  }

  const rateLine = d.rates.length
    ? d.rates
        .map((r) => `${r.currency} ${r.rate_to_pln === null ? 'Kurs niedostępny' : rate(r.rate_to_pln)}`)
        .join(' · ')
    : null;

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <button className="btn-link" onClick={() => onNav({ name: 'client', clientId })}>← Faktury klienta</button>
          <h1>Faktura, {monthLabel(inv.period_month)}</h1>
          <div className="meta">
            <span>{inv.client_name}</span>
            <span className="muted">Waluta faktury: {invCur}</span>
            <StatusBadge tone={isOpen ? 'open' : 'closed'}>{isOpen ? 'Otwarta' : 'Zamknięta'}</StatusBadge>
            {inv.rate_missing && <StatusBadge tone="warn">Brak kursu</StatusBadge>}
          </div>
          {rateLine && <div className="muted">Kursy NBP: {rateLine}</div>}
        </div>
        <div className="total">
          <span className="muted">Suma ogólna</span>
          <strong className="total-amount">
            {amountHidden ? 'Kurs niedostępny' : `${money(d.total)} ${invCur}`}
          </strong>
          {inv.is_stale && !amountHidden && <Notice kind="warn">Kurs nieaktualny</Notice>}
        </div>
      </div>

      {actionError && <Notice>{actionError}</Notice>}

      <div className="actions">
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={busy}>Dodaj pozycję</button>
        )}
        {canEdit && (
          <button
            className="btn"
            onClick={closeInvoice}
            disabled={busy || !canClose}
            title={!closeAllowed(inv.period_month) ? 'Zamknięcie możliwe po końcu miesiąca' : undefined}
          >
            Zamknij fakturę
          </button>
        )}
        {canEdit && !closeAllowed(inv.period_month) && (
          <span className="muted">Zamknięcie możliwe po końcu miesiąca</span>
        )}
        {role === 'creator' && isClosed && (
          <button className="btn" onClick={() => setReopening(true)} disabled={busy}>Otwórz ponownie</button>
        )}
      </div>

      {CATEGORIES.map((cat) => {
        const rows = d.positions.filter((p) => p.category === cat);
        return (
          <div key={cat} className="category">
            <div className="category-head">
              <h2>{cat}</h2>
              <span>Suma: <strong>{categoryTotal(cat)}</strong>{categoryTotal(cat) !== 'Kurs niedostępny' && ` ${invCur}`}</span>
            </div>
            {rows.length === 0 ? (
              <Empty>Brak pozycji</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nazwa</th>
                      <th className="num">Ilość</th>
                      <th className="num">Cena</th>
                      <th className="num">Kwota w walucie pozycji</th>
                      <th className="num">Kwota w walucie faktury</th>
                      <th>Źródło ilości</th>
                      {canEdit && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.name}
                          {registerNotFilled(p) && <div><StatusBadge tone="warn">rejestr niewypełniony</StatusBadge></div>}
                        </td>
                        <td className="num">
                          {p.quantity_mode === 'percent' ? `${qty(p.quantity)}%` : qty(p.quantity)}
                        </td>
                        <td className="num">
                          {p.quantity_mode === 'percent' ? '—' : `${money(p.price)} ${p.price_currency ?? ''}`}
                        </td>
                        <td className="num">
                          {p.quantity_mode === 'percent'
                            ? '—'
                            : `${money(p.amount_position_currency) ?? '—'} ${p.price_currency ?? ''}`}
                        </td>
                        <td className="num">
                          {p.amount_invoice_currency === null ? 'brak kursu' : `${money(p.amount_invoice_currency)} ${invCur}`}
                        </td>
                        <td>
                          {p.quantity_mode === 'register'
                            ? `${p.register_name ?? '—'} · ${p.variable_name ?? '—'}`
                            : p.quantity_mode === 'percent'
                              ? 'Procent'
                              : 'Ręcznie'}
                        </td>
                        {canEdit && (
                          <td className="row-actions">
                            <button className="btn-link" onClick={() => setEditing(p)}>Edytuj</button>
                            <button className="btn-link danger" onClick={() => deletePosition(p)}>Usuń</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <History events={d.events} invCur={invCur} />

      {editing && (
        <PositionModal
          ctx={{ kind: 'invoice', invoice: inv }}
          initial={editing === 'new' ? null : initialFromPosition(editing)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load.reload();
          }}
        />
      )}

      {reopening && (
        <Modal title="Otwórz ponownie fakturę" onClose={() => setReopening(false)}>
          <div className="stack">
            <label>
              Komentarz
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </label>
            {!comment.trim() && <span className="muted">Podaj powód otwarcia</span>}
            <div className="actions">
              <button className="btn" onClick={() => setReopening(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={reopenInvoice} disabled={busy || !comment.trim()}>
                Otwórz ponownie
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function History({ events, invCur }: { events: EventRow[]; invCur: string }) {
  return (
    <div className="history">
      <h2>Historia</h2>
      {events.length === 0 && <Empty>Brak zdarzeń</Empty>}
      <ul className="events">
        {events.map((e, i) => {
          const diff = toNum(e.amount_difference);
          const diffText =
            diff === null
              ? '—'
              : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${money(Math.abs(diff))} ${invCur}`;
          return (
            <li key={`${e.created_at}-${i}`} className="event">
              <div className="event-head">
                <StatusBadge tone={e.event_type === 'open' ? 'open' : 'closed'}>
                  {e.event_type === 'open' ? 'Otwarta' : 'Zamknięta'}
                </StatusBadge>
                <span>{dateTimePl(e.created_at)}</span>
                <span className="muted">{e.user_name ?? '—'}</span>
              </div>
              {e.comment && <div>Komentarz: {e.comment}</div>}
              <div className="muted">
                {e.event_type === 'open' ? 'Kwota przy otwarciu' : 'Kwota przy zamknięciu'}:{' '}
                {e.amount_at_event === null ? '—' : `${money(e.amount_at_event)} ${invCur}`}
              </div>
              {e.event_type === 'close' && <div className="muted">Różnica: {diffText}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
