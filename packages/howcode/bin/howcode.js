#!/usr/bin/env node

import('../build/server/index.mjs').catch((error) => {
  console.error(error)
  process.exitCode = 1
})
