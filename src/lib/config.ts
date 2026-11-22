// Публичные значения из контракта базы (kontrakt_bazy_v5.md, раздел 1).
// Ключ service_role здесь и нигде в проекте не используется.
const env = import.meta.env;

export const SUPABASE_URL: string =
  env.VITE_SUPABASE_URL || 'https://ummkoxhwdrwmlnanzuuo.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY: string =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_rQeGWKBDddihmOiiTbdraQ_XwG_ZFpG';

// Адрес, на который Supabase вернёт пользователя из письма сброса пароля.
// Точный адрес нужно вписать в Supabase Auth (Site URL и Redirect URLs).
// Domyślnie korzeń aplikacji (BASE_URL). Na GitHub Pages dodatkowa ścieżka dawałaby 404.
// Aplikacja rozpoznaje powrót z linku po zdarzeniu PASSWORD_RECOVERY, więc ścieżka nie jest potrzebna.
export const RESET_REDIRECT_URL: string =
  env.VITE_RESET_REDIRECT_URL || new URL(env.BASE_URL, window.location.origin).href;
