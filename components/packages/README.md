# Live package UI

An installed package directory can contain `ui.tsx`. Howcode publishes its UI to the browser without restarting the server or resetting the conversation. Installation uses the existing commands:

```sh
howcode install ./my-package
howcode update ./my-package
howcode remove ./my-package
```

Local source edits become a new generation only after `howcode update`. Use the same `--data-path` as the running server when it uses a custom data directory.

Older installations without a recorded revision must be updated before their UI can load.

## Package entrypoints

Export `mount(container, context)` from `ui.tsx`. Mount into the supplied DOM element and return a cleanup function. An asynchronous mount can return a promise of that function. Respect `context.signal` during asynchronous work and release listeners, timers, subscriptions and framework roots during cleanup.

```tsx
import { createRoot } from 'react-dom/client'

export function mount(container, context) {
  const root = createRoot(container)
  root.render(<button onClick={() => context.call('hello', null)}>Hello</button>)
  return () => root.unmount()
}
```

The module is bundled as one browser ESM file. React imports resolve from Howcode's runtime and are bundled into the package's independent root. Do not pass React components or elements to the host. Other browser dependencies resolve from the installed package. Import styles as JavaScript strings and own their insertion and removal. Separate emitted CSS and code-split assets are not supported.

A UI-only package needs no Durable extension. Omit backend entrypoints such as `main`, a root export, `pi.extensions`, an `extensions` directory, or `index.js`. A tool-and-UI package keeps its normal Durable entrypoints alongside `ui.tsx`. Explicit backend declarations still fail when invalid.

## Browser RPC

Optionally export one default handler from `ui-rpc.ts`. The handler is server code, not a model-callable tool. Dispatch and validate your own method names and input. Requests and results must be JSON values.

```ts
export default async function handle(method, input, context) {
  context.signal.throwIfAborted()
  if (method !== 'hello') throw new Error('Unknown UI method')
  return { message: 'Hello from the server' }
}
```

The mount context provides `id`, `revision`, `signal`, and `call(method, input)`. The handler context provides the same package identity and a server `signal` that aborts when the installed generation is replaced, removed, or shut down. A mount's disposal rejects late browser results, but does not cancel an already admitted server request. Do not start persistent resources at module scope.

Only currently installed IDs and exact revisions can load modules or invoke handlers. Neither API accepts a filesystem path. The existing authenticated desktop bridge carries both operations.

## Host integration

The renderer surface is `@howcode/components/packages/ui/index`. `watchPackageUiCatalog(receive)` delivers the initial inventory and live invalidations, including a refresh after reconnection. It returns an unsubscribe function. `mountPackageUiHost(container, id, receive)` follows one installed package, replacing and cleaning up its mount when the revision changes. It returns a disposer. `mountPackageUi` mounts a single descriptor and returns `{ ready, dispose }`.

These functions do not choose a sidebar, route, or layout. The caller owns placement. Catalog and mount states report failures explicitly. A broken update replaces the previous descriptor with an error. There is no automatic last-good fallback.

Installed packages are trusted code. Browser UI runs in the same page with the user's access. Server RPC runs with the server process's access. This is not a sandbox or a permission boundary.
