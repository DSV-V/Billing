import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { unwrap, useLoad } from '../lib/useLoad';
import { errorMessage } from '../lib/errors';
import { currentPeriod } from '../lib/format';
import {
  CATEGORIES,
  type CurrencyRow,
  type InvoiceRow,
  type Num,
  type PositionRow,
  type QuantityMode,
  type RegisterRow,
  type TemplateRow,
  type VariableRow,
} from '../lib/types';
import { ErrorBlock, Loading, Modal, Notice } from '../components/ui';

// Stan pozycji do edycji, niezależny od tego, czy to faktura, czy szablon.
export interface PositionInitial {
  id: number;
  name: string;
  category: string;
  price: Num | null;
  price_currency: string | null;
  quantity_mode: QuantityMode;
  register_variable_id: number | null;
  // Ilość ręczna albo procent. Dla trybu z rejestru pusta.
  quantity_value: Num | null;
}

export function initialFromPosition(p: PositionRow): PositionInitial {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    price_currency: p.price_currency,
    quantity_mode: p.quantity_mode,
    register_variable_id: p.register_variable_id,
    quantity_value: p.quantity_mode === 'register' ? null : p.quantity,
  };
}

export function initialFromTemplate(t: TemplateRow): PositionInitial {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    price: t.price,
    price_currency: t.price_currency,
    quantity_mode: t.quantity_mode,
    register_variable_id: t.register_variable_id,
    quantity_value: t.quantity_mode === 'register' ? null : t.manual_quantity,
  };
}

// Kontekst: pozycja faktury albo pozycja szablonu klienta.
export type PositionCtx =
  | { kind: 'invoice'; invoice: InvoiceRow }
  | { kind: 'template'; clientId: number };

interface Props {
  ctx: PositionCtx;
  initial: PositionInitial | null; // null — nowa pozycja
  onClose: () => void;
  onSaved: () => void;
}

const MODE_LABEL: Record<QuantityMode, string> = {
  register: 'Z rejestru',
  manual: 'Ręcznie',
  percent: 'Procent',
};

export function PositionModal({ ctx, initial, onClose, onSaved }: Props) {
  const clientId = ctx.kind === 'invoice' ? ctx.invoice.client_id : ctx.clientId;
  // Wartości zmiennych i rejestrów bierzemy z miesiąca faktury; dla szablonu z bieżącego miesiąca.
  const period = ctx.kind === 'invoice' ? ctx.invoice.period_month.slice(0, 10) : currentPeriod();

  const meta = useLoad(async () => {
    const [curRes, regRes, varRes] = await Promise.all([
      supabase.from('nbp_currencies').select('code,name').order('code'),
      supabase.rpc('registers_for_month', { p_period: period }),
      supabase.rpc('register_variables_for_month', { p_client_id: clientId, p_period: period }),
    ]);
    return {
      currencies: (unwrap(curRes) ?? []) as CurrencyRow[],
      registers: ((unwrap(regRes) ?? []) as RegisterRow[]).filter((r) => r.client_id === clientId),
      variables: (unwrap(varRes) ?? []) as VariableRow[],
    };
  }, [clientId, period]);

  const title = initial
    ? 'Edycja pozycji'
    : ctx.kind === 'template'
      ? 'Nowa pozycja szablonu'
      : 'Nowa pozycja';

  return (
    <Modal title={title} onClose={onClose}>
      {meta.loading && <Loading />}
      {meta.error != null && <ErrorBlock message={errorMessage(meta.error)} onRetry={meta.reload} />}
      {meta.data && (
        <Fields
          ctx={ctx}
          initial={initial}
          currencies={meta.data.currencies}
          registers={meta.data.registers}
          variables={meta.data.variables}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

interface FieldsProps {
  ctx: PositionCtx;
  initial: PositionInitial | null;
  currencies: CurrencyRow[];
  registers: RegisterRow[];
  variables: VariableRow[];
  onClose: () => void;
  onSaved: () => void;
}

function Fields({ ctx, initial, currencies, registers, variables, onClose, onSaved }: FieldsProps) {
  const isEdit = initial !== null;
  const isInvoice = ctx.kind === 'invoice';
  const defaultCurrency = ctx.kind === 'invoice' ? ctx.invoice.invoice_currency : '';

  // Stan początkowy: z pozycji do edycji albo puste pola dla nowej.
  const initVariable = initial?.register_variable_id ?? null;
  const initRegisterId =
    initVariable !== null ? String(variables.find((v) => v.variable_id === initVariable)?.register_id ?? '') : '';

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<string>(initial?.category ?? CATEGORIES[0]);
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '');
  const [priceCurrency, setPriceCurrency] = useState(initial?.price_currency ?? defaultCurrency);
  const [mode, setMode] = useState<QuantityMode>(initial?.quantity_mode ?? 'register');
  const [registerId, setRegisterId] = useState(initRegisterId);
  const [variableId, setVariableId] = useState(initVariable !== null ? String(initVariable) : '');
  // Jedno pole na ilość ręczną i na procent: znaczenie zależy od trybu.
  const [qtyText, setQtyText] = useState(initial?.quantity_value != null ? String(initial.quantity_value) : '');
  const [addToTemplate, setAddToTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variablesOfRegister = variables.filter((v) => String(v.register_id) === registerId);
  const isPercent = mode === 'percent';

  function fail(msg: string) {
    setError(msg);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return fail('Podaj nazwę');

    if (isPercent) {
      if (qtyText.trim() === '' || Number.isNaN(Number(qtyText))) return fail('Podaj procent');
    } else {
      const priceNum = Number(price);
      if (price === '' || Number.isNaN(priceNum) || priceNum < 0) return fail('Podaj cenę nie mniejszą niż 0');
      if (!priceCurrency) return fail('Wybierz walutę pozycji');
      if (mode === 'register' && !variableId) return fail('Wybierz rejestr i zmienną');
      // Pusta ilość ręczna jest dozwolona i zapisuje się jako NULL, który liczy się jako 0.
      if (mode === 'manual' && qtyText.trim() !== '' && Number.isNaN(Number(qtyText))) {
        return fail('Podaj ilość liczbą');
      }
    }

    // Parametry wspólne dla funkcji faktury i szablonu.
    const payload = {
      p_name: name.trim(),
      p_price: isPercent ? null : Number(price),
      p_price_currency: isPercent ? null : priceCurrency,
      p_quantity_mode: mode,
      p_register_variable_id: mode === 'register' ? Number(variableId) : null,
      p_manual_quantity:
        mode === 'register' ? null : qtyText.trim() === '' ? null : Number(qtyText),
    };

    setBusy(true);
    let err: unknown = null;
    if (ctx.kind === 'invoice') {
      if (isEdit) {
        ({ error: err } = await supabase.rpc('update_position', { p_position_id: initial!.id, ...payload }));
      } else {
        ({ error: err } = await supabase.rpc('add_position', {
          p_invoice_id: ctx.invoice.id,
          p_category: category,
          p_add_to_template: addToTemplate,
          ...payload,
        }));
      }
    } else if (isEdit) {
      ({ error: err } = await supabase.rpc('update_template_position', {
        p_template_id: initial!.id,
        p_sort_order: null, // kolejność bez zmian
        ...payload,
      }));
    } else {
      ({ error: err } = await supabase.rpc('add_template_position', {
        p_client_id: ctx.clientId,
        p_category: category,
        ...payload,
      }));
    }
    setBusy(false);

    if (err) fail(errorMessage(err, 'position'));
    else onSaved();
  }

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Nazwa
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label>
        Kategoria
        {isEdit ? (
          <input value={category} disabled />
        ) : (
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <span className="hint">Ustalana przy dodaniu. Później nie można jej zmienić.</span>
      </label>

      {!isPercent && (
        <div className="row">
          <label>
            Cena
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </label>
          <label>
            Waluta pozycji
            <select value={priceCurrency} onChange={(e) => setPriceCurrency(e.target.value)} required>
              <option value="">— wybierz —</option>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select>
          </label>
        </div>
      )}

      <fieldset className="fieldset">
        <legend>Ilość</legend>

        {isEdit ? (
          // Tryb ustalany przy dodaniu i w edycji nie zmienia się.
          <span className="muted">Tryb: {MODE_LABEL[mode]}</span>
        ) : (
          (['register', 'manual', 'percent'] as QuantityMode[]).map((m) => (
            <label key={m} className="check">
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
              {MODE_LABEL[m]}
            </label>
          ))
        )}

        {mode === 'register' && (
          <div className="row">
            <label>
              Rejestr
              <select
                value={registerId}
                onChange={(e) => {
                  setRegisterId(e.target.value);
                  setVariableId('');
                }}
              >
                <option value="">— wybierz —</option>
                {registers.map((r) => (
                  <option key={r.register_id} value={String(r.register_id)}>
                    {r.register_name} ({r.is_filled ? 'wypełniony' : 'niewypełniony'})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Zmienna
              <select value={variableId} onChange={(e) => setVariableId(e.target.value)} disabled={!registerId}>
                <option value="">— wybierz —</option>
                {variablesOfRegister.map((v) => (
                  <option key={v.variable_id} value={String(v.variable_id)}>
                    {v.variable_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {mode === 'manual' && (
          <label>
            Wartość ilości
            <input type="number" step="0.01" value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
            <span className="hint">Puste pole oznacza 0.</span>
          </label>
        )}

        {isPercent && (
          <label>
            Procent (%)
            <input type="number" step="any" value={qtyText} onChange={(e) => setQtyText(e.target.value)} required />
            <span className="hint">Liczony od zwykłych pozycji tej samej kategorii w walucie faktury.</span>
          </label>
        )}
      </fieldset>

      {isInvoice && !isEdit && (
        <label className="check">
          <input type="checkbox" checked={addToTemplate} onChange={(e) => setAddToTemplate(e.target.checked)} />
          Dodaj do szablonu
        </label>
      )}

      {error && <Notice>{error}</Notice>}

      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>Anuluj</button>
        <button className="btn btn-primary" disabled={busy}>Zapisz</button>
      </div>
    </form>
  );
}
