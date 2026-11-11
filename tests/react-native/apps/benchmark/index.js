/**
 * @format
 */

import { AppRegistry } from 'react-native'
import { BenchmarkApp } from './src/benchmarks/BenchmarkApp'
import { name as appName } from './app.json'

AppRegistry.registerComponent(appName, () => BenchmarkApp)
