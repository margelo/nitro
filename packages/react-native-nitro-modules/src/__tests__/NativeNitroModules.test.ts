import { version } from 'nitro-core/package.json'

const getEnforcing = jest.fn()

function loadNitro(): typeof import('../turbomodule/NativeNitroModules') {
  let loaded!: typeof import('../turbomodule/NativeNitroModules')
  jest.isolateModules(() => {
    loaded = jest.requireActual('../turbomodule/NativeNitroModules')
  })
  return loaded
}

beforeEach(() => {
  jest.resetModules()
  getEnforcing.mockReset()
  globalThis.NitroModulesProxy = undefined
  jest.doMock('react-native', () => ({
    TurboModuleRegistry: { getEnforcing },
    NativeModules: {},
    Platform: { OS: 'ios' },
  }))
})

afterEach(() => {
  globalThis.NitroModulesProxy = undefined
})

it('uses the proxy installed synchronously during TurboModule lookup', () => {
  const proxy = { version }
  getEnforcing.mockImplementation(() => {
    globalThis.NitroModulesProxy = proxy
    return {}
  })

  expect(loadNitro().NitroModules).toBe(proxy)
  expect(getEnforcing).toHaveBeenCalledTimes(1)
  expect(getEnforcing).toHaveBeenCalledWith('NitroModules')
})

it('reuses the installed proxy when another bundle evaluates Nitro', () => {
  const proxy = { version }
  getEnforcing.mockImplementation(() => {
    globalThis.NitroModulesProxy = proxy
    return {}
  })

  expect(loadNitro().NitroModules).toBe(proxy)
  expect(loadNitro().NitroModules).toBe(proxy)
  expect(getEnforcing).toHaveBeenCalledTimes(1)
})

it('rejects a proxy installed by a different Nitro version', () => {
  globalThis.NitroModulesProxy = { version: '0.0.0' }

  expect(loadNitro).toThrow(
    'Nitro was installed twice: once with native version 0.0.0'
  )
  expect(getEnforcing).not.toHaveBeenCalled()
})

it('preserves errors thrown by the native JSI installation hook', () => {
  const cause = new Error('Native JSI installation failed')
  getEnforcing.mockImplementation(() => {
    throw cause
  })

  expect(loadNitro).toThrow(expect.objectContaining({ cause }))
})

it('reports when the TurboModule loads without installing its JSI proxy', () => {
  getEnforcing.mockReturnValue({})

  expect(loadNitro).toThrow(
    expect.objectContaining({
      cause: expect.objectContaining({
        message:
          'The NitroModules TurboModule loaded, but its JSI bindings did not install `global.NitroModulesProxy`.',
      }),
    })
  )
})
