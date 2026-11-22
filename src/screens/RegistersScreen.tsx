import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { unwrap, useLoad } from '../lib/useLoad';
import { errorMessage } from '../lib/errors';
import { currentPeriod, monthLabel, qty } from '../lib/format';
import type { ClientRow, InvoiceRow, Nav, RegisterRow, Role, VariableRow } from '../lib/types';
import { Empty, ErrorBlock, Loading, Notice, StatusBadge } from '../components/ui';

interface Props {
  clientId: number;
  role: Role;
  onNav: (n: Nav) => void;
}

export default function RegistersScreen({ clientId, role, onNav }: Props) {
  const [period, setPeriod] = useState(currentPeriod());
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Клиент и его счета: для списка месяцев и для проверки, закрыт ли счёт за месяц.
  const base = useLoad(async () => {
    const [clientRes, invRes] = await Promise.all([
      supabase.from('v_clients').select('id,name,invoice_currency,admins').eq('id', clientId).maybeSingle(),
      supabase.from('v_invoices').select('*').eq('client_id', clientId),
    ]);
    return {
      client: unwrap(clientRes) as ClientRow | null,
      invoices: (unwrap(invRes) ?? []) as InvoiceRow[],
    };
  }, [clientId]);

  // Реестры и переменные за выбранный месяц, включая пустые.
  const data = useLoad(async () => {
    const [regRes, varRes] = await Promise.all([
      supabase.rpc('registers_for_month', { p_period: period }),
      supabase.rpc('register_variables_for_month', { p_client_id: clientId, p_period: period }),
    ]);
    return {
      registers: ((unwrap(regRes) ?? []) as RegisterRow[]).filter((r) => r.client_id === clientId),
      variables: (unwrap(varRes) ?? []) as VariableRow[],
    };
  }, [clientId, period]);

  const months = useMemo(() => {
    const set = new Set<string>([currentPeriod()]);
    base.data?.invoices.forEach((i) => set.add(i.period_month.slice(0, 10)));
    return Array.from(set).sort().reverse();
  }, [base.data]);

  if (base.loading) return <Loading />;
  if (base.error) return <ErrorBlock message={errorMessage(base.error)} onRetry={base.reload} />;

  const invoiceForPeriod = base.data?.invoices.find((i) => i.period_month.slice(0, 10) === period);
  // Закрытый счёт за месяц: значения не меняются ни для одной роли.
  const locked = invoiceForPeriod?.status === 'closed';
  const canEdit = role !== 'client' && !locked;

  async function save(variableId: number) {
    const raw = drafts[variableId] ?? '';
    if (raw.trim() === '' || Number.isNaN(Number(raw))) {
      setError('Podaj wartość');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('set_register_value', {
      p_variable_id: variableId,
      p_period: period,
      p_value: Number(raw),
    });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    setDrafts((d) => {
      const copy = { ...d };
      delete copy[variableId];
      return copy;
    });
    data.reload();
  }

  const client = base.data?.client;

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <button className="btn-link" onClick={() => onNav({ name: 'client', clientId })}>← Faktury klienta</button>
          <h1>Rejestry{client ? `: ${client.name}` : ''}</h1>
        </div>
        <label className="period">
          Miesiąc
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </label>
      </div>

      {locked && <Notice kind="info">Faktura za ten miesiąc jest zamknięta. Wartości są tylko do odczytu.</Notice>}
      {error && <Notice>{error}</Notice>}

      {data.loading && <Loading />}
      {data.error != null && <ErrorBlock message={errorMessage(data.error)} onRetry={data.reload} />}

      {data.data && data.data.registers.length === 0 && <Empty>Brak rejestrów</Empty>}

      {data.data?.registers.map((reg) => {
        const vars = (data.data?.variables ?? []).filter((v) => v.register_id === reg.register_id);
        return (
          <div key={reg.register_id} className="register">
            <div className="category-head">
              <h2>{reg.register_name}</h2>
              <StatusBadge tone={reg.is_filled ? 'ok' : 'muted'}>
                {reg.is_filled ? 'Wypełniony' : 'Niewypełniony'}
              </StatusBadge>
            </div>
            {vars.length === 0 ? (
              <Empty>Brak zmiennych</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Zmienna</th>
                    <th className="num">Wartość</th>
                    {canEdit && <th>Nowa wartość</th>}
                  </tr>
                </thead>
                <tbody>
                  {vars.map((v) => (
                    <tr key={v.variable_id}>
                      <td>{v.variable_name}</td>
                      <td className="num">{v.has_value ? qty(v.value) : '—'}</td>
                      {canEdit && (
                        <td className="row-actions">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={drafts[v.variable_id] ?? ''}
                            onChange={(e) => setDrafts((d) => ({ ...d, [v.variable_id]: e.target.value }))}
                            aria-label={`Nowa wartość: ${v.variable_name}`}
                          />
                          <button className="btn" onClick={() => save(v.variable_id)} disabled={busy}>Zapisz</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </section>
  );
}
