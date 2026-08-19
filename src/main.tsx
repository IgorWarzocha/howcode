import { QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/geist-mono'
import './styles.css'
import App from './app'
import { applyStoredPiGuiTheme } from './app/app-shell/usePiGuiTheme'
import { queryClient } from './app/query/query-client'

function applyDesktopPlatformAttribute() {
  const platform = window.piDesktop?.platform ?? 'browser'
  document.documentElement.setAttribute('data-desktop-platform', platform)
  document.documentElement.setAttribute(
    'data-desktop-shell',
    window.piDesktop && !window.howcodeDevWebBridge ? 'electron' : 'browser',
  )
}

if (import.meta.env.DEV) {
  void import('react-grab')
}

const bridgeInstallPromise =
  !window.piDesktop && window.location.protocol.startsWith('http')
    ? import('./app/dev-web-bridge').then(({ installDevWebDesktopBridge }) =>
        installDevWebDesktopBridge(),
      )
    : Promise.resolve()

void bridgeInstallPromise
  .then(() => {
    applyDesktopPlatformAttribute()
    applyStoredPiGuiTheme()
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>,
    )
  })
  .catch((error) => {
    const root = document.getElementById('root')
    if (root) {
      root.innerHTML = `<pre class="bootstrap-error">Bootstrap error:\n${String(error)}</pre>`
    }

    throw error
  })
