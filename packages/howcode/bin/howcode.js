#!/usr/bin/env node

const packageCommands = new Set(['install', 'remove', 'list', 'update'])
const entry = packageCommands.has(process.argv[2])
  ? '../build/desktop/package-cli.mjs'
  : '../build/server/index.mjs'

import(entry).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
