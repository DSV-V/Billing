// Типы строк из представлений v_* и функций (kontrakt_bazy_v5.md, раздел 4 и 5).
// numeric может прийти строкой, поэтому везде допускаем number | string.

export type Role = 'creator' | 'admin' | 'client';

export type Nav =
  | { name: 'clients' }
  | { name: 'client'; clientId: number }
  | { name: 'invoice'; clientId: number; invoiceId: number }
  | { name: 'registers'; clientId: number }
  | { name: 'template'; clientId: number };

export type QuantityMode = 'manual' | 'register' | 'percent';

export type Num = number | string;

export interface ClientRow {
  id: number;
  name: string;
  invoice_currency: string;
  admins: { id: number; name: string }[];
}

export interface InvoiceRow {
  id: number;
  client_id: number;
  client_name: string;
  period_month: string;
  invoice_currency: string;
  status: 'open' | 'closed';
  total_amount: Num | null;
  is_stale: boolean;
  rate_missing: boolean;
}

export interface PositionRow {
  id: number;
  invoice_id: number;
  name: string;
  category: string;
  price: Num | null;
  price_currency: string | null;
  quantity: Num;
  quantity_mode: QuantityMode;
  register_variable_id: number | null;
  template_id: number | null;
  amount_position_currency: Num | null;
  amount_invoice_currency: Num | null;
  is_stale: boolean;
  register_name: string | null;
  variable_name: string | null;
}

// Wiersz zwracany przez get_template(p_client_id). Dla procentu manual_quantity to procent.
export interface TemplateRow {
  id: number;
  name: string;
  category: string;
  price: Num | null;
  price_currency: string | null;
  quantity_mode: QuantityMode;
  register_variable_id: number | null;
  manual_quantity: Num | null;
  sort_order: number;
}

export interface CategoryTotalRow {
  invoice_id: number;
  category: string;
  total_amount: Num | null;
}

export interface InvoiceTotalRow {
  invoice_id: number;
  total_amount: Num | null;
}

export interface RateInfoRow {
  currency: string;
  rate_to_pln: Num | null;
  rate_date: string | null;
  is_stale: boolean;
}

export interface EventRow {
  invoice_id: number;
  event_type: 'open' | 'close';
  user_name: string | null;
  comment: string | null;
  amount_at_event: Num | null;
  amount_difference: Num | null;
  created_at: string;
}

export interface RegisterRow {
  register_id: number;
  client_id: number;
  register_name: string;
  period_month: string;
  is_filled: boolean;
}

export interface VariableRow {
  register_id: number;
  register_name: string;
  variable_id: number;
  variable_name: string;
  value: Num | null;
  has_value: boolean;
}

export interface AdminRow {
  id: number;
  name: string;
  email: string;
}

export interface CurrencyRow {
  code: string;
  name: string;
}

export const CATEGORIES = ['Handling', 'Storage', 'Transport', 'Refactoring'] as const;
