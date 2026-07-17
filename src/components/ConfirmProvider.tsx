'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import Modal from './Modal';

type Opts = { title?: string; message: string; confirmText?: string; danger?: boolean };
type ConfirmFn = (opts: Opts) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export function useConfirm() { return useContext(ConfirmCtx); }

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: Opts; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })), []);
  function close(v: boolean) { state?.resolve(v); setState(null); }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          title={state.opts.title || 'Xác nhận'}
          onClose={() => close(false)}
          maxWidth={430}
          footer={<>
            <button className="btn" onClick={() => close(false)}>Huỷ</button>
            <button className={'btn ' + (state.opts.danger ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)}>
              {state.opts.confirmText || 'Xác nhận'}
            </button>
          </>}
        >
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>{state.opts.message}</p>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
