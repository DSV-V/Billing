import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Notice } from '../components/ui';

interface Props {
  onDone: () => void;
}

export default function NewPasswordScreen({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    if (password !== repeat) {
      setError('Hasła nie są takie same.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError('Nie udało się zmienić hasła. Poproś o nowy link.');
      return;
    }
    // Убираем параметры из адресной строки и продолжаем работу в приложении.
    window.history.replaceState({}, '', '/');
    onDone();
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Faktury · GDN</h1>
        <form onSubmit={save} className="stack">
          <h2>Nowe hasło</h2>
          <label>
            Nowe hasło
            <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            Powtórz hasło
            <input type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </label>
          {error && <Notice>{error}</Notice>}
          <button className="btn btn-primary" disabled={busy}>Zapisz hasło</button>
        </form>
      </div>
    </div>
  );
}
