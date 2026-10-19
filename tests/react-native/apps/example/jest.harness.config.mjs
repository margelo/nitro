export default {
  preset: 'react-native-harness',
  testMatch: ['<rootDir>/**/__tests__/**/*.harness.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/setupAfterEnv.ts'],
  verbose: true,
  reporters: ['default', ['summary', { summaryThreshold: 0 }]],
}
