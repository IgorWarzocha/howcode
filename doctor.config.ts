export default {
  ignore: {
    files: ['dist-pages/**', 'Frameworks/**'],
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

    // Attachment roots come from the trusted desktop picker, are canonicalized with realpath, and
    // descendants are constrained to that root before filesystem access.
    'react-doctor/path-traversal-risk': 'off',

    // Updates are restricted to the configured release origin and verified against SHA-256 metadata
    // before installation; the heuristic cannot follow that validation across the updater flow.
    'react-doctor/plugin-update-trust-risk': 'off',
  },
}
