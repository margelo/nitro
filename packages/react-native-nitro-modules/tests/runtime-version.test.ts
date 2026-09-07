import fs from 'node:fs'
import path from 'node:path'

it('embeds only the package version in the runtime module', () => {
  const packageJsonPath = path.resolve(__dirname, '../package.json')
  const nativeModulePath = path.resolve(
    __dirname,
    '../src/turbomodule/NativeNitroModules.ts'
  )
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    version: string
  }
  const nativeModule = fs.readFileSync(nativeModulePath, 'utf8')

  expect(nativeModule).not.toContain(
    "require('react-native-nitro-modules/package.json')"
  )
  expect(nativeModule).toContain(`const jsVersion = '${packageJson.version}'`)
})
