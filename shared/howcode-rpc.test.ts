import { describe, expect, it } from 'vitest'
import { HOWCODE_RPC_METHODS, HOWCODE_RPC_WS_PATH, HowcodeRpcGroup } from './howcode-rpc'

describe('howcode rpc contracts', () => {
  it('pins the websocket path for the hard-cut server protocol', () => {
    expect(HOWCODE_RPC_WS_PATH).toBe('/api/app/rpc')
  })

  it('exposes request and event stream rpc methods', () => {
    expect([...HowcodeRpcGroup.requests.keys()].sort()).toEqual(
      [HOWCODE_RPC_METHODS.appRequest, HOWCODE_RPC_METHODS.eventsSubscribe].sort(),
    )
  })
})
