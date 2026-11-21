import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = { children: ReactNode };
type State = { error: Error | null };

/** A broken manager-only component must never leave an empty white page. */
export default class ManagerErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UZTOVARKA Manager Hub render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4 py-10 text-[#171A20]">
      <section role="alert" className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <AlertTriangle size={23} />
        </div>
        <h1 className="text-xl font-extrabold">Menejer panelida xatolik</h1>
        <p className="mt-2 text-sm text-neutral-600">Sahifani ko‘rsatishda texnik muammo yuz berdi. Quyidagi tugma bilan qayta oching.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FACC15] px-4 font-semibold">
            <RefreshCw size={17} /> Qayta yuklash
          </button>
          <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl border border-neutral-200 px-4 text-sm font-medium">Kirish sahifasi</Link>
        </div>
        <details className="mt-5 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
          <summary className="cursor-pointer font-semibold">Texnik xatolik tafsiloti</summary>
          <p className="mt-2 break-words">{this.state.error.message}</p>
        </details>
      </section>
    </main>;
  }
}
