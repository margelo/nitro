/* eslint-disable react/no-unstable-nested-components */
import * as React from 'react'
import { HybridObjectTestsScreen } from './screens/HybridObjectTestsScreen'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useColors } from './useColors'
import { Image } from 'react-native'
import { ViewScreen } from './screens/ViewScreen'
import { EvalScreen } from './screens/EvalScreen'
import { ChildrenScreen } from './screens/ChildrenScreen'

const dna = require('./img/dna.png')
const map = require('./img/map.png')
const terminal = require('./img/terminal.webp')

const Tabs = createBottomTabNavigator()

export default function App() {
  const colors = useColors()
  return (
    <NavigationContainer>
      <Tabs.Navigator
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="Tests"
          component={HybridObjectTestsScreen}
          options={{
            tabBarLabel: 'Tests',
            tabBarIcon: ({ size, color }) => (
              <Image
                source={dna}
                tintColor={color}
                style={{ width: size * 1.2, height: size * 1.2 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="View"
          component={ViewScreen}
          options={{
            tabBarLabel: 'View',
            tabBarIcon: ({ size, color }) => (
              <Image
                source={map}
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="Children"
          component={ChildrenScreen}
          options={{
            tabBarLabel: 'Children',
            tabBarIcon: ({ size, color }) => (
              <Image
                source={map}
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="Eval"
          component={EvalScreen}
          options={{
            tabBarLabel: 'Eval',
            tabBarIcon: ({ size, color }) => (
              <Image
                source={terminal}
                tintColor={color}
                style={{ width: size, height: size }}
              />
            ),
          }}
        />
      </Tabs.Navigator>
    </NavigationContainer>
  )
}
