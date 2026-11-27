jest.mock('../NitroModules', () => ({
  NitroModules: { box: jest.fn(() => ({ unbox: jest.fn() })) },
}))
jest.mock('react-native-worklets', () => ({
  registerCustomSerializable: jest.fn(),
}))

import { installWorkletsSupport } from '../worklets/installWorkletsSupport'

const { box: mockBox } = jest.requireMock('../NitroModules').NitroModules
const { registerCustomSerializable: mockRegisterCustomSerializable } =
  jest.requireMock('react-native-worklets')

describe('installWorkletsSupport()', () => {
  beforeEach(() => {
    mockBox.mockClear()
    mockRegisterCustomSerializable.mockReset()
  })

  it('propagates Nitro boxing errors', () => {
    const error = new Error('Failed to box NitroModules')
    mockBox.mockImplementationOnce(() => {
      throw error
    })

    expect(() => installWorkletsSupport()).toThrow(error)
  })

  it('propagates Worklets registration errors', () => {
    const error = new Error('Failed to register custom serializer')
    mockRegisterCustomSerializable.mockImplementationOnce(() => {
      throw error
    })

    expect(() => installWorkletsSupport()).toThrow(error)
  })
})
