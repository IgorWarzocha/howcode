# howcode

Howcode is a browser app for coding with Pi. The local Node server runs your agent sessions, terminal, files, and Git workflows.

Requires Node 24.15 or newer, below Node 27.

```bash
npx howcode
# or
npm install -g howcode
howcode
```

Open the access URL printed by the server. Keep the process running while you work. Press Ctrl+C to stop it.

To connect from another device on a trusted network:

```bash
howcode --host 0.0.0.0 --port 4173
howcode --host 0.0.0.0 --port 4173 --token my-secret
```

The default host is `127.0.0.1`. Remote access requires a token. The server generates one unless you pass `--token` or set `HOWCODE_HEADLESS_TOKEN`. Loopback access needs no token by default. Do not expose it to strangers. Project files, commands, terminal processes, and agent tools run on the server machine. Browser-picked files upload to temporary host storage.

The package includes the server and browser assets. npm installs the native `node-pty` and `sherpa-onnx-node` dependencies for your platform. Native installation may require a compiler toolchain. No desktop runtime or release archive is downloaded at launch.

Update with `npm install -g howcode@latest`. Remove a global install with `npm uninstall -g howcode`. Removing the package does not remove your project files or Howcode data.
