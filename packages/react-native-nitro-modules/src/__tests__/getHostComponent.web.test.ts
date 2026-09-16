jest.mock(
  'react-native/Libraries/NativeComponent/NativeComponentRegistry',
  () => {
    throw new Error('NativeComponentRegistry must not be loaded on web')
  }
)

import { getHostComponent } from '../views/getHostComponent.web'

describe('getHostComponent on web', () => {
  it('loads without importing native React Native internals', () => {
    expect(() =>
      getHostComponent('TestView', () => {
        throw new Error('View config must not be read on web')
      })
    ).toThrow('Nitro View "TestView" is not supported on web')
  })
})
