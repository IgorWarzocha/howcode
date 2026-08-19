const { main: run } = require('./main')

async function main() {
  try {
    await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`howcode: ${message}`)
    process.exit(1)
  }
}

module.exports = { main }

if (require.main === module) {
  void main()
}
