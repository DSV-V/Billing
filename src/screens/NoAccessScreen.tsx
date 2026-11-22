interface Props {
  onSignOut: () => void;
}

export default function NoAccessScreen({ onSignOut }: Props) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Brak dostępu</h1>
        <p>Brak dostępu. Skontaktuj się z administratorem.</p>
        <button className="btn" onClick={onSignOut}>Wyloguj się</button>
      </div>
    </div>
  );
}
