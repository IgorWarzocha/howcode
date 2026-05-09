import { describe, expect, it } from 'vitest'
import {
  assertCompatibleHowcodeServerDescriptor,
  howcodeServerDescriptor,
} from './howcode-server-contracts'

describe('Howcode server contracts', () => {
  it('accepts the current server descriptor', () => {
    expect(() => assertCompatibleHowcodeServerDescriptor(howcodeServerDescriptor)).not.toThrow()
  })

  it('rejects incompatible protocol versions', () => {
    expect(() =>
      assertCompatibleHowcodeServerDescriptor({
        ...howcodeServerDescriptor,
        protocolVersion: howcodeServerDescriptor.protocolVersion + 1,
      }),
    ).toThrow('Incompatible Howcode server protocol')
  })
})
