import { useCallback, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import type { Nav } from './lib/types';
import { Loading } from './components/ui';
import LoginScreen from './screens/LoginScreen';
import NewPasswordScreen from './screens/NewPasswordScreen';
import NoAccessScreen from './screens/NoAccessScreen';
import ClientsScreen from './screens/ClientsScreen';
import ClientInvoicesScreen from './screens/ClientInvoicesScreen';
import InvoiceScreen from './screens/InvoiceScreen';
import RegistersScreen from './screens/RegistersScreen';
import TemplateScreen from './screens/TemplateScreen';

export default function App() {
  const auth = useAuth();
  const [nav, setNavState] = useState<Nav>({ name: 'clients' });
  // Стабильная функция: экраны используют её в эффектах.
  const onNav = useCallback((n: Nav) => setNavState(n), []);

  if (!auth.ready) return <Loading />;
  if (auth.recovery) return <NewPasswordScreen onDone={auth.clearRecovery} />;
  if (!auth.signedIn) return <LoginScreen />;
  if (!auth.role) return <NoAccessScreen onSignOut={auth.signOut} />;

  const role = auth.role;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => onNav({ name: 'clients' })}>Faktury · GDN</button>
        <div className="topbar-right">
          <span className="muted">{role === 'creator' ? 'Twórca' : role === 'admin' ? 'Administrator' : 'Klient'}</span>
          <button className="btn-ghost" onClick={auth.signOut}>Wyloguj się</button>
        </div>
      </header>

      <main className="content">
        {nav.name === 'clients' && (
          <ClientsScreen role={role} userId={auth.userId} onNav={onNav} />
        )}
        {nav.name === 'client' && (
          <ClientInvoicesScreen clientId={nav.clientId} role={role} onNav={onNav} />
        )}
        {nav.name === 'invoice' && (
          <InvoiceScreen invoiceId={nav.invoiceId} clientId={nav.clientId} role={role} onNav={onNav} />
        )}
        {nav.name === 'registers' && (
          <RegistersScreen clientId={nav.clientId} role={role} onNav={onNav} />
        )}
        {nav.name === 'template' && (
          <TemplateScreen clientId={nav.clientId} role={role} onNav={onNav} />
        )}
      </main>
    </div>
  );
}
