import { useState, useEffect, useRef } from 'react'
import { Server, X, Eye, EyeOff, Loader2, AlertCircle, ChevronRight, Folder, ArrowLeft, Check, CornerDownLeft, Trash2, BookMarked } from 'lucide-react'
import type { SSHConfig, SSHProfileSummary } from '../../../../shared/types'
import type { FileEntry } from '../../../../shared/types'
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap'

// ─── Saved profiles list ──────────────────────────────────────────────────────

function SavedProfiles({
  profiles,
  onSelect,
  onDelete,
}: {
  profiles: SSHProfileSummary[]
  onSelect: (profile: SSHProfileSummary) => void
  onDelete: (id: string) => void
}): React.JSX.Element | null {
  if (profiles.length === 0) return null
  return (
    <div className="border-b border-zinc-700 px-5 py-3 space-y-1">
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-2">Conexões salvas</p>
      {profiles.map((profile) => (
        <div key={profile.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-700/60 transition-colors">
          <button
            onClick={() => onSelect(profile)}
            className="flex flex-1 items-center gap-2.5 min-w-0"
          >
            <BookMarked size={12} className="shrink-0 text-indigo-400" />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs font-medium text-zinc-200 truncate max-w-full">
                {profile.label || profile.host}
              </span>
              <span className="text-[11px] text-zinc-500 truncate max-w-full">
                {profile.username}@{profile.host}:{profile.port} · {profile.remotePath}
              </span>
            </div>
          </button>
          <button
            onClick={() => onDelete(profile.id)}
            className="shrink-0 rounded p-1 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Remover"
            aria-label={`Remover conexão ${profile.label || profile.host}`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

interface SSHConnectionModalProps {
  onConnect: (config: SSHConfig, remotePath: string) => void
  onClose: () => void
  initialConfig?: SSHConfig
}

const DEFAULT_CONFIG: SSHConfig = {
  label: '',
  host: '',
  port: 22,
  username: '',
  authMethod: 'password',
  password: '',
  keyPath: '',
  passphrase: '',
  remotePath: '/'
}

// ─── Step 1: Connection form ──────────────────────────────────────────────────

function ConnectStep({
  config,
  onChange,
  onConnect,
  onClose,
}: {
  config: SSHConfig
  onChange: <K extends keyof SSHConfig>(key: K, value: SSHConfig[K]) => void
  onConnect: () => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const [showPassword, setShowPassword] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(): Promise<void> {
    if (!config.host.trim()) return setError('Host é obrigatório')
    if (!config.username.trim()) return setError('Usuário é obrigatório')
    if (config.authMethod === 'password' && !config.password) return setError('Senha é obrigatória')
    if (config.authMethod === 'key' && !config.keyPath?.trim()) return setError('Caminho da chave SSH é obrigatório')

    setIsConnecting(true)
    setError(null)
    try {
      await onConnect()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsConnecting(false)
    }
  }

  const input = 'w-full rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none ring-1 ring-zinc-700 placeholder:text-zinc-600 focus:ring-indigo-500 transition-colors'
  const label = 'mb-1 block text-xs font-medium text-zinc-400'

  return (
    <>
      <div className="space-y-4 px-5 py-5">
        <div>
          <p className={label}>Nome da conexão <span className="text-zinc-600">(opcional)</span></p>
          <input className={input} placeholder="Ex: Minha VPS" value={config.label} onChange={(e) => onChange('label', e.target.value)} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <p className={label}>Host</p>
            <input className={input} placeholder="192.168.1.100" value={config.host} onChange={(e) => onChange('host', e.target.value)} autoFocus />
          </div>
          <div className="w-20">
            <p className={label}>Porta</p>
            <input className={input} type="number" min={1} max={65535} value={config.port} onChange={(e) => onChange('port', Number(e.target.value))} />
          </div>
        </div>

        <div>
          <p className={label}>Usuário</p>
          <input className={input} placeholder="root" value={config.username} onChange={(e) => onChange('username', e.target.value)} />
        </div>

        <div>
          <p className={label}>Autenticação</p>
          <div className="flex rounded-md bg-zinc-900 p-0.5 ring-1 ring-zinc-700 w-fit gap-0.5">
            {(['password', 'key'] as const).map((method) => (
              <button
                key={method}
                onClick={() => onChange('authMethod', method)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${config.authMethod === method ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {method === 'password' ? 'Senha' : 'Chave SSH'}
              </button>
            ))}
          </div>
        </div>

        {config.authMethod === 'password' ? (
          <div>
            <p className={label}>Senha</p>
            <div className="relative">
              <input
                className={`${input} pr-9`}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={config.password ?? ''}
                onChange={(e) => onChange('password', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className={label}>Caminho da chave SSH</p>
              <input className={input} placeholder="/home/user/.ssh/id_rsa" value={config.keyPath ?? ''} onChange={(e) => onChange('keyPath', e.target.value)} />
            </div>
            <div>
              <p className={label}>Passphrase <span className="text-zinc-600">(opcional)</span></p>
              <input className={input} type="password" placeholder="••••••••" value={config.passphrase ?? ''} onChange={(e) => onChange('passphrase', e.target.value)} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-950/50 px-3 py-2.5 text-xs text-red-400 ring-1 ring-red-900/60">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-700 px-5 py-4">
        <button onClick={onClose} disabled={isConnecting} className="rounded-md px-4 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-40">
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={isConnecting}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
        >
          {isConnecting && <Loader2 size={13} className="animate-spin" />}
          {isConnecting ? 'Conectando...' : 'Conectar'}
        </button>
      </div>
    </>
  )
}

// ─── Step 2: Remote directory browser ────────────────────────────────────────

function BrowseStep({
  initialPath,
  onConfirm,
  onBack,
}: {
  initialPath: string
  onConfirm: (path: string) => Promise<void>
  onBack: () => void
}): React.JSX.Element {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [listing, setListing] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // urlInput is what the user types; kept in sync with currentPath on successful load
  const [urlInput, setUrlInput] = useState(initialPath)
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadPath(path: string): Promise<void> {
    // Normalise: ensure leading slash, strip trailing slash (except root)
    const normalised = ('/' + path.replace(/^\/+/, '')).replace(/(.+)\/$/, '$1') || '/'
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.fs.listDir(normalised)
      if (!result.ok) throw new Error(result.error)
      const dirs = (result.data ?? [])
        .filter((e) => e.type === 'directory' && !e.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name))
      setListing(dirs)
      setCurrentPath(normalised)
      setUrlInput(normalised)
    } catch (err) {
      setError((err as Error).message)
      // Reset input to last valid path on error
      setUrlInput(currentPath)
    } finally {
      setIsLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPath(initialPath) }, [])

  function handleUrlSubmit(): void {
    const trimmed = urlInput.trim()
    if (trimmed && trimmed !== currentPath) loadPath(trimmed)
  }

  function navigateUp(): void {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadPath(parent)
  }

  // Breadcrumb segments from currentPath
  const segments = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean)

  return (
    <>
      {/* URL / path input */}
      <div className="flex items-center gap-2 border-b border-zinc-700 bg-zinc-900/50 px-3 py-2">
        <span className="shrink-0 text-zinc-600 text-xs font-mono select-none">sftp://</span>
        <input
          ref={inputRef}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleUrlSubmit() }
            if (e.key === 'Escape') { setUrlInput(currentPath); inputRef.current?.blur() }
          }}
          onFocus={(e) => e.currentTarget.select()}
          spellCheck={false}
          className="flex-1 bg-transparent text-xs font-mono text-zinc-200 outline-none placeholder:text-zinc-600"
          placeholder="/home/user"
        />
        {isLoading ? (
          <Loader2 size={12} className="shrink-0 animate-spin text-zinc-600" />
        ) : (
          <button
            onClick={handleUrlSubmit}
            title="Navegar para o caminho (Enter)"
            className="shrink-0 rounded p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"
            aria-label="Navegar para o caminho digitado"
          >
            <CornerDownLeft size={12} />
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 border-b border-zinc-700/60 bg-zinc-900/30 px-4 py-1.5 text-[11px] text-zinc-500 overflow-x-auto">
        <button onClick={() => loadPath('/')} className="shrink-0 hover:text-zinc-200 transition-colors">/</button>
        {segments.map((seg, i) => {
          const segPath = '/' + segments.slice(0, i + 1).join('/')
          return (
            <span key={segPath} className="flex items-center gap-1 shrink-0">
              <ChevronRight size={9} className="text-zinc-700" />
              <button onClick={() => loadPath(segPath)} className="hover:text-zinc-200 transition-colors">{seg}</button>
            </span>
          )
        })}
      </div>

      {/* Listing */}
      <div className="overflow-y-auto px-2 py-1" style={{ minHeight: 180, maxHeight: 260 }}>
        {error ? (
          <div className="flex items-start gap-2 m-2 rounded-md bg-red-950/50 px-3 py-2.5 text-xs text-red-400 ring-1 ring-red-900/60">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-600">
            <Loader2 size={13} className="animate-spin" />
            Carregando...
          </div>
        ) : (
          <>
            {currentPath !== '/' && (
              <button
                onClick={navigateUp}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
              >
                <ArrowLeft size={12} className="shrink-0" />
                <span>..</span>
              </button>
            )}
            {listing.length === 0 && (
              <p className="px-3 py-4 text-xs text-zinc-600">Pasta vazia</p>
            )}
            {listing.map((entry) => (
              <button
                key={entry.path}
                onClick={() => loadPath(entry.path)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-zinc-700"
              >
                <Folder size={12} className="shrink-0 text-amber-400" />
                <span className="flex-1 truncate text-zinc-300">{entry.name}</span>
                <ChevronRight size={10} className="shrink-0 text-zinc-600" />
              </button>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between gap-2 border-t border-zinc-700 px-5 py-4">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200">
          <ArrowLeft size={13} />
          Voltar
        </button>
        <button
          onClick={() => {
            // Se o usuário digitou algo na URL bar sem pressionar Enter, usa esse valor
            const typed = urlInput.trim()
            const confirmed = typed && typed !== currentPath ? typed : currentPath
            const normalised = ('/' + confirmed.replace(/^\/+/, '')).replace(/(.+)\/$/, '$1') || '/'
            onConfirm(normalised)
          }}
          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <Check size={13} />
          Usar esta pasta
        </button>
      </div>
    </>
  )
}

// ─── Wizard root ──────────────────────────────────────────────────────────────

export function SSHConnectionModal({ onConnect, onClose, initialConfig }: SSHConnectionModalProps): React.JSX.Element {
  const [step, setStep] = useState<'connect' | 'browse'>('connect')
  const [config, setConfig] = useState<SSHConfig>(initialConfig ?? DEFAULT_CONFIG)
  const [savedProfiles, setSavedProfiles] = useState<SSHProfileSummary[]>([])
  const dialogRef = useModalFocusTrap({ onClose: handleClose })

  useEffect(() => {
    window.api.credentials.list().then(setSavedProfiles).catch(() => setSavedProfiles([]))
  }, [])

  function handleChange<K extends keyof SSHConfig>(key: K, value: SSHConfig[K]): void {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSelectProfile(profile: SSHProfileSummary): Promise<void> {
    const full = await window.api.credentials.get(profile.id)
    if (full) setConfig(full)
  }

  async function handleDeleteProfile(id: string): Promise<void> {
    setSavedProfiles((prev) => prev.filter((p) => p.id !== id))
    await window.api.credentials.delete(id)
  }

  async function handleConnect(): Promise<void> {
    const result = await window.api.ssh.connect({ ...config, remotePath: '/' })
    if (!result.ok) throw new Error(result.error ?? 'Falha na conexão')
    setStep('browse')
  }

  async function handleBack(): Promise<void> {
    await window.api.ssh.disconnect()
    setStep('connect')
  }

  async function handleConfirm(remotePath: string): Promise<void> {
    const finalConfig = { ...config, remotePath }
    onConnect(finalConfig, remotePath)
  }

  function handleClose(): void {
    if (step === 'browse') {
      window.api.ssh.disconnect()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ssh-modal-title"
        tabIndex={-1}
        className="flex w-[460px] flex-col rounded-xl border border-zinc-700 bg-zinc-800 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600/20">
              <Server size={14} className="text-indigo-400" />
            </div>
            <span id="ssh-modal-title" className="text-sm font-semibold text-zinc-100">
              {step === 'connect' ? 'Conectar via VPS' : 'Selecionar pasta remota'}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            aria-label="Fechar conexão VPS"
          >
            <X size={14} />
          </button>
        </div>

        {step === 'connect' ? (
          <>
            <SavedProfiles
              profiles={savedProfiles}
              onSelect={handleSelectProfile}
              onDelete={handleDeleteProfile}
            />
            <ConnectStep
              config={config}
              onChange={handleChange}
              onConnect={handleConnect}
              onClose={handleClose}
            />
          </>
        ) : (
          <BrowseStep
            initialPath={config.remotePath || '/'}
            onConfirm={handleConfirm}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  )
}
