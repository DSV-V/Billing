import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { RESET_REDIRECT_URL } from '../lib/config';
import { Notice } from '../components/ui';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError('Nieprawidłowy email lub hasło.');
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT_URL,
    });
    setBusy(false);
    if (err) setError('Nie udało się wysłać linku. Spróbuj ponownie.');
    else setInfo('Jeśli konto istnieje, wysłaliśmy na podany adres link do ustawienia hasła.');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Faktury · GDN</h1>

        {mode === 'login' ? (
          <form onSubmit={login} className="stack">
            <h2>Logowanie</h2>
            <label>
              Email
              <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Hasło
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <Notice>{error}</Notice>}
            <button className="btn btn-primary" disabled={busy}>Zaloguj się</button>
            <button type="button" className="btn-link" onClick={() => { setMode('reset'); setError(null); }}>
              Nie pamiętam hasła
            </button>
          </form>
        ) : (
          <form onSubmit={reset} className="stack">
            <h2>Ustawienie hasła</h2>
            <label>
              Email
              <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && <Notice>{error}</Notice>}
            {info && <Notice kind="info">{info}</Notice>}
            <button className="btn btn-primary" disabled={busy}>Wyślij link</button>
            <button type="button" className="btn-link" onClick={() => { setMode('login'); setInfo(null); setError(null); }}>
              Wróć do logowania
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
