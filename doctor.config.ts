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
      {
        files: ['src/app/features/pi-extensions/pi-extension-dialog-card.tsx'],
        rules: ['react-doctor/no-loading-flag-reset-outside-finally'],
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
    'react-doctor/no-prop-callback-in-effect': 'off',

    // Long-lived controller surfaces reset feature-local transient state when their ownership props
    // change. Remounting those surfaces would also discard unrelated drafts, focus, and scroll state.
    'react-doctor/no-adjust-state-on-prop-change': 'off',
  },
}
