const mockHybridPrototype = {}
const mockCreateHybridObject = jest.fn(() => Object.create(mockHybridPrototype))

jest.mock('../NitroModules', () => ({
  NitroModules: {
    createHybridObject: mockCreateHybridObject,
  },
}))

const { getHybridObjectConstructor } = require('../getHybridObjectConstructor')

describe('getHybridObjectConstructor', () => {
  it.each([null, undefined, true, 42, 'value', Symbol('value'), 1n])(
    'returns false for non-object value %p',
    (value) => {
      const HybridObject = getHybridObjectConstructor('TestObject')

      expect((value as any) instanceof HybridObject).toBe(false)
      expect(mockCreateHybridObject).not.toHaveBeenCalled()
    }
  )
})
