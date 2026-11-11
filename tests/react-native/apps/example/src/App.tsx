import * as React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ViewScreen } from './screens/ViewScreen'

export default function App() {
  return (
    <SafeAreaProvider>
      <ViewScreen />
    </SafeAreaProvider>
  )
}
