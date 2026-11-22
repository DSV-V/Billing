import { useEffect, type ReactNode } from 'react';

export function Notice({ kind = 'error', children }: { kind?: 'error' | 'warn' | 'info'; children: ReactNode }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Loading({ label = 'Ładowanie…' }: { label?: string }) {
  return <div className="loading">{label}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="stack">
      <Notice>{message}</Notice>
      <div>
        <button className="btn" onClick={onRetry}>Spróbuj ponownie</button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Zamknij">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type Tone = 'open' | 'closed' | 'warn' | 'muted' | 'ok';

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
