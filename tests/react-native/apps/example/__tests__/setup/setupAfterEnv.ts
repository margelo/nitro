import { chai } from 'react-native-harness'

// Harness only forwards `error.message` of a failed assertion to the CLI, and
// chai cuts values in it off at 40 characters by default (e.g.
// `{ year: 2018, …(6) }`). vitest exposes the same setting as
// `chaiConfig.truncateThreshold`.
chai.config.truncateThreshold = 0
