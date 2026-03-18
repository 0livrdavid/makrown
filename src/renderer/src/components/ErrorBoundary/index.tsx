import React from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string | null
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message,
    }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-lg font-semibold text-zinc-50">Algo deu errado</h1>
          <p className="mt-2 text-sm text-zinc-400">
            O aplicativo encontrou um erro inesperado. Recarregue para voltar ao estado estável.
          </p>
          {this.state.errorMessage && (
            <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-500">
              {this.state.errorMessage}
            </p>
          )}
          <button
            onClick={this.handleReload}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            <RefreshCcw size={14} />
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
