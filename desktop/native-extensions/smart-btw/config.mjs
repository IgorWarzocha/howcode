const DEFAULT_CONFIG = {
  thinking: 'low',
  command: 'pi',
}

export function readConfig() {
  const env = process.env
  const model = env.HOWCODE_SMART_BTW_MODEL?.trim() || env.HOWCODE_COMPOSER_MODEL?.trim() || ''
  const thinking = env.HOWCODE_SMART_BTW_THINKING?.trim() || DEFAULT_CONFIG.thinking
  return {
    model,
    thinking,
    command: env.HOWCODE_SMART_BTW_COMMAND?.trim() || DEFAULT_CONFIG.command,
  }
}
