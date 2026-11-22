// Коды ошибок базы (P0001 с кодом в тексте) и польские тексты для пользователя.
// Источник: opisanie_strony.md, раздел 6. Код CURRENCY_NOT_SUPPORTED добавлен
// по контракту v5, его текст согласован с координатором. Все тексты рабочие,
// их нужно проверить носителю польского языка.

const MESSAGES: Record<string, string> = {
  NOT_AUTHORIZED: 'Brak dostępu',
  NOT_CREATOR: 'Ta operacja jest dostępna tylko dla twórcy',
  NAME_REQUIRED: 'Podaj nazwę',
  CURRENCY_INVALID: 'Nieprawidłowy kod waluty',
  CURRENCY_NOT_SUPPORTED: 'Nieobsługiwana waluta, wybierz z listy',
  CATEGORY_INVALID: 'Nieprawidłowa kategoria',
  MODE_INVALID: 'Nieprawidłowy tryb ilości',
  ADMIN_REQUIRED: 'Wybierz administratora',
  ADMIN_SELF_ONLY: 'Administrator może przypisać tylko siebie',
  USER_ROLE_INVALID: 'Można przypisać tylko administratorów i klientów',
  CLIENT_NOT_FOUND: 'Nie znaleziono klienta',
  INVOICE_NOT_FOUND: 'Nie znaleziono faktury',
  POSITION_NOT_FOUND: 'Nie znaleziono pozycji',
  VARIABLE_NOT_FOUND: 'Nie znaleziono zmiennej rejestru',
  PERIOD_INVALID: 'Podaj pierwszy dzień miesiąca',
  VALUE_REQUIRED: 'Podaj wartość',
  INVOICE_EXISTS: 'Faktura za ten miesiąc już istnieje',
  INVOICE_CLOSED: 'Faktura jest zamknięta, zmiany są niedostępne',
  INVOICE_NOT_OPEN: 'Faktura jest już zamknięta',
  INVOICE_NOT_CLOSED: 'Faktura jest już otwarta',
  INVOICE_CLOSE_TOO_EARLY: 'Zamknięcie możliwe po końcu miesiąca',
  COMMENT_REQUIRED: 'Podaj powód otwarcia',
  RATE_MISSING: 'Nie można zamknąć: brak kursu NBP',
  VARIABLE_OTHER_CLIENT: 'Zmienna nie należy do tego klienta',
  CATEGORY_LOCKED: 'Kategorii nie można zmienić',
  CLIENT_CURRENCY_IMMUTABLE: 'Waluty klienta nie można zmienić',
  INVOICE_CURRENCY_LOCKED: 'Waluty faktury nie można zmienić',
  CREATOR_NO_ASSIGNMENT: 'Twórcy nie przypisuje się do klienta',
  CLIENT_ONE_CLIENT_ONLY: 'Klient może mieć tylko jednego przypisanego klienta',
  NBP_RATE_LOCKED: 'Kurs zamkniętego okresu nie podlega zmianie',
  EVENT_IMMUTABLE: 'Wpisów dziennika nie można zmieniać',
  EVENT_DELETE_CREATOR_ONLY: 'Usunąć wpis może tylko twórca',
};

export const GENERIC_ERROR = 'Wystąpił błąd. Spróbuj ponownie.';

// Более длинные коды проверяем первыми, чтобы короткий не перекрывал длинный.
const CODES = Object.keys(MESSAGES).sort((a, b) => b.length - a.length);

export function errorCode(err: unknown): string | null {
  const text = (err as { message?: string } | null)?.message ?? '';
  return CODES.find((code) => text.includes(code)) ?? null;
}

export function errorMessage(err: unknown, context: 'default' | 'position' = 'default'): string {
  const code = errorCode(err);
  if (code) return MESSAGES[code];

  // Ограничения таблиц (например, согласованность режима количества) приходят как 23514.
  const sqlCode = (err as { code?: string } | null)?.code;
  if (sqlCode === '23514') {
    return context === 'position' ? 'Nieprawidłowe dane pozycji' : 'Nieprawidłowe dane';
  }
  return GENERIC_ERROR;
}
