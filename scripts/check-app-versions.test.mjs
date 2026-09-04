import { expect, test } from 'bun:test'
import { findAppVersionMismatches } from './check-app-versions.mjs'

function aligned() {
  return {
    '.': { version: '1.0.0', devDependencies: { react: '19.2.3' } },
    'apps/example': {
      version: '1.0.0',
      dependencies: { 'react': '19.2.3', 'react-native': '0.85.3' },
      devDependencies: {
        'react-native-harness': '1.4.1',
        '@babel/core': '^7.29.7',
      },
    },
    'apps/benchmark': {
      version: '1.0.0',
      dependencies: { 'react': '19.2.3', 'react-native': '0.85.3' },
      devDependencies: { '@babel/core': '^7.29.7' },
    },
  }
}

test('allows app-specific dependencies such as Harness', () => {
  expect(findAppVersionMismatches(aligned())).toEqual([])
})

test('reports React Native drift with both declared versions', () => {
  const manifests = aligned()
  manifests['apps/benchmark'].dependencies['react-native'] = '0.86.0'
  expect(findAppVersionMismatches(manifests)).toEqual([
    'react-native: apps/example=0.85.3, apps/benchmark=0.86.0',
  ])
})

test('checks the root React version too', () => {
  const manifests = aligned()
  manifests['.'].devDependencies.react = '19.1.0'
  expect(findAppVersionMismatches(manifests)[0]).toContain('react: .=19.1.0')
})

test('checks shared build tools without equating different version ranges', () => {
  const manifests = aligned()
  manifests['apps/benchmark'].devDependencies['@babel/core'] = '7.29.7'
  expect(findAppVersionMismatches(manifests)[0]).toContain('@babel/core:')
})

test('checks app versions used by release automation', () => {
  const manifests = aligned()
  manifests['apps/benchmark'].version = '0.9.0'
  expect(findAppVersionMismatches(manifests)[0]).toContain(
    'must match root 1.0.0'
  )
})

test('does not silently accept a missing app or missing runtime dependency', () => {
  const manifests = aligned()
  delete manifests['apps/benchmark'].dependencies.react
  expect(findAppVersionMismatches(manifests)[0]).toContain('direct dependency')
  delete manifests['apps/benchmark']
  expect(findAppVersionMismatches(manifests)).toEqual([
    'apps/benchmark/package.json is missing.',
  ])
})
