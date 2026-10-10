# Live package UI

## Full Howcode components

Packages with `howcode` metadata use the same install, update and remove commands as standalone UI packages. Declare public `renderer`, `host` and `service` exports using the Howcode SDK contribution contracts. The host prepares them as one generation. Services become available before the browser admits the renderer. No manual rebuild or restart is needed for an ordinary profile component.

The CLI reports ready, error or bounded pending status. Pending can mean the host is offline, agent work is still active, or no browser has admitted the prepared renderer. Updates and removals wait for active agent work and component requests. They do not replay actions or delete producer-owned stored data.

Full renderers share Howcode's React and SDK contexts. Their Providers own feature state and workspace surfaces. Attachments and output previews render beneath that Provider without replacing the application tree. Imported CSS belongs to the generation and is removed with it. Other emitted assets must be inlined or served by the component.

The contribution contract accepts the shell's existing routes and commands. Use workspace surfaces for new presentations. Bundled components with shell-owned adapters, currently Git, must be changed through a supported shell build and handoff rather than a profile override.

## Standalone UI

An installed package directory can contain `ui.tsx`. Howcode publishes its UI to the browser without restarting the server or resetting the conversation. Installation uses the existing commands:

```sh
howcode install ./my-package
howcode update ./my-package
howcode remove ./my-package
```

Local source edits become a new generation only after `howcode update`. Use the same `--data-path` as the running server when it uses a custom data directory.

Older installations without a recorded revision must be updated before their UI can load.

## Package entrypoints

Export a `UiComponent` named `component` from `ui.tsx`. The SDK validates snapshots with the component's `parseState`, grants its declared actions and streams, and owns the mount lifetime. Mount into the supplied DOM element and return a cleanup function. An asynchronous mount can return a promise of that function.

```tsx
import type { UiComponent } from '@howaboua/pi-durable-ui'

export const component: UiComponent<{ count: number }> = {
  id: 'counter',
  version: 1,
  actions: ['increment'],
  streams: [],
  parseState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.count !== 'number') throw new Error('Invalid counter state')
    return { count: value.count }
  },
  mount(container, context) {
    const button = document.createElement('button')
    const render = () => { button.textContent = String(context.state.getSnapshot().count) }
    const unsubscribe = context.state.subscribe(render)
    button.addEventListener('click', () => {
      void context.call('increment', null).catch(console.error)
    }, { signal: context.signal })
    container.replaceChildren(button)
    render()
    return () => { unsubscribe(); container.replaceChildren() }
  },
}
```

The module is bundled as one browser ESM file. React imports resolve from Howcode's runtime and are bundled into the package's independent root. Do not pass React components or elements to the host. Other browser dependencies resolve from the installed package. Import styles as JavaScript strings and own their insertion and removal. Separate emitted CSS and code-split assets are not supported.

A UI-only package needs no Durable extension. Omit backend entrypoints such as `main`, a root export, `pi.extensions`, an `extensions` directory, or `index.js`. A tool-and-UI package keeps its normal Durable entrypoints alongside `ui.tsx`. Explicit backend declarations still fail when invalid.

## Server binding

Export `createBinding(context)` from `ui-binding.ts`. Return the SDK's `UiBinding`, synchronously or asynchronously. The factory is server code, not a model-callable tool. It receives the authorized installed package `id`, `revision`, and session `signal`. Use the package's own Durable capabilities and state. Howcode does not dispatch on component type.

```ts
import type { UiBinding } from '@howaboua/pi-durable-ui'

export function createBinding(): UiBinding {
  let snapshot = { sequence: 0, value: { count: 0 } }
  const listeners = new Set<(value: typeof snapshot) => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(next) {
      listeners.add(next)
      return () => { listeners.delete(next) }
    },
    async call(action, input, { signal }) {
      signal.throwIfAborted()
      if (action !== 'increment' || input !== null) throw new Error('Action not granted')
      snapshot = { sequence: snapshot.sequence + 1, value: { count: snapshot.value.count + 1 } }
      for (const next of listeners) next(snapshot)
      return null
    },
  }
}
```

Snapshots carry a nonnegative safe-integer `sequence` and JSON `value`. Increase the sequence for each state change. The host subscribes before reading the initial snapshot. The SDK parses state before publishing it and ignores stale sequences. Server calls and stream values must also be JSON.

The mount context provides `id`, `signal`, `state`, `call(action, input, options?)`, and `stream(name, input, options?)`. Pass an operation `signal` to cancel a single call or stream without unmounting the component. A binding's optional `stream` returns an async iterable. Respect the supplied operation signal, unblock pending reads when aborted, and release resources when the iterator closes. The server receives cancellation and joins owned work, rather than merely discarding late browser results.

Unmounting, channel disconnection, package retirement, and shutdown abort the binding session, release its subscription, and cancel its active operations. Async factories must honor their session signal. Subscribe cleanup may be asynchronous. Do not start persistent resources at module scope. An abandoned session that never acquires an event reader expires after 30 seconds.

Only currently installed IDs and exact revisions can open bindings or load modules. Neither API accepts a filesystem path. The existing authenticated desktop bridge carries requests. Each browser mount owns an authenticated event channel with bounded buffering. A disconnected mount fails visibly and does not replay actions. Remount explicitly to reconnect.

## Host integration

The renderer surface is `@howcode/components/packages/ui/index`. `watchPackageUiCatalog(receive)` delivers the initial inventory and live invalidations, including a refresh after reconnection. It returns an unsubscribe function. `mountPackageUiHost(container, id, receive)` follows one installed package, replacing and cleaning up its mount when the revision changes. It returns a disposer. `mountPackageUi` mounts a single descriptor and returns `{ ready, dispose }`.

These functions do not choose a sidebar, route, or layout. The caller owns placement. Catalog and mount states report failures explicitly. A broken update replaces the previous descriptor with an error. There is no automatic last-good fallback.

Installed packages are trusted code. Browser UI runs in the same page with the user's access. Server bindings run with the server process's access. This is not a sandbox or a permission boundary.
