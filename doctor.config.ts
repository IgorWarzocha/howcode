export default {
  ignore: {
    files: ['dist-pages/**', 'Frameworks/**'],
    overrides: [
      {
        files: ['src/desktop-host/composer-attachments.ts'],
        rules: ['react-doctor/path-traversal-risk'],
      },
      {
        files: ['src/electron/main/updater/app-updater.ts'],
        rules: ['react-doctor/plugin-update-trust-risk'],
      },
    ],
  },
  rules: {
    // These packages are load-time/native packaging roots. Static imports are intentionally absent.
    'deslop/unused-dependency': 'off',

    // Howcode's large surfaces are orchestration components with feature-owned children. Biome's
    // enforced complexity limit remains the structural gate; raw line and boolean counts are not.
    'react-doctor/no-giant-component': 'off',
    'react-doctor/no-many-boolean-props': 'off',

    // The Pages site is a single static entry by design. Its local components do not affect app HMR.
    'react-doctor/no-multi-comp': 'off',

    // These effects synchronize imperative parent-owned refs/overlays after committed async data.
    // Moving them into render or event paths would publish stale, uncommitted state instead.
    'react-doctor/no-pass-data-to-parent': 'off',
    'react-doctor/no-pass-live-state-to-parent': 'off',
  },
}
