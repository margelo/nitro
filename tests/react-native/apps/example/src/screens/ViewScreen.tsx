import * as React from 'react'

import { StyleSheet, View, Text, Button, Platform } from 'react-native'
import { callback, NitroModules } from 'react-native-nitro-modules'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../useColors'
import { RecyclableTestView, TestView } from 'react-native-nitro-test'

const VIEWS_X = 15
const VIEWS_Y = 15

export function ViewScreen() {
  const safeArea = useSafeAreaInsets()
  const colors = useColors()
  const [counter, setCounter] = React.useState(0)
  const [isUpdating, setIsUpdating] = React.useState(true)

  const views = React.useMemo(
    () =>
      [...Array(counter)].map((_, i) => {
        if (i % 3 === 0) {
          return (
            <TestView
              key={i}
              hybridRef={callback((ref) => {
                console.log(`Ref initialized!`)
                ref.someMethod()
                const isBlue = ref.getIsViewBlue(ref)
                console.log(`Is View blue: ${isBlue}`)
              })}
              style={styles.view}
              isBlue={i % 2 === 0}
              someCallback={callback(() => console.log(`Callback called!`))}
              colorScheme="dark"
              hasBeenCalled={false}
              int64Value={0n}
              onTouchEnd={() => {
                console.log(`Touched View #${i}!`)
              }}
            />
          )
        } else {
          return (
            <RecyclableTestView
              key={i}
              style={styles.view}
              isBlue={i % 2 === 0}
              onTouchEnd={() => {
                console.log(`Touched View #${i}!`)
              }}
            />
          )
        }
      }),
    [counter]
  )

  React.useEffect(() => {
    if (!isUpdating) return
    const i = setInterval(
      () => setCounter((c) => (c >= VIEWS_X * VIEWS_Y ? 0 : c + 1)),
      10
    )
    return () => clearInterval(i)
  }, [isUpdating])

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeArea.top,
          paddingBottom: safeArea.bottom,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Text style={[styles.header, { color: colors.text }]}>Nitro Views</Text>
      <View style={styles.topControls}>
        <View style={styles.flex} />
        <Text style={[styles.buildTypeText, { color: colors.text }]}>
          {NitroModules.buildType}
        </Text>
      </View>

      <View style={styles.resultContainer}>
        <View style={[styles.viewShadow]}>
          <View style={[styles.viewBorder, { borderColor: colors.foreground }]}>
            <View style={styles.viewContainer}>{views}</View>
          </View>
        </View>
      </View>

      <View style={[styles.bottomView, { backgroundColor: colors.background }]}>
        <Text
          style={[styles.resultText, { color: colors.text }]}
          numberOfLines={2}
        >
          {counter} views {isUpdating ? '(updating)' : '(paused)'}
        </Text>
        <View style={styles.flex} />
        <Button
          title={isUpdating ? 'Stop Updating' : 'Start Updating'}
          onPress={() => setIsUpdating((i) => !i)}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    paddingBottom: 15,
    marginHorizontal: 15,
  },
  container: {
    flex: 1,
  },
  topControls: {
    marginHorizontal: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buildTypeText: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      macos: 'Menlo',
      android: 'monospace',
    }),
    fontWeight: 'bold',
  },
  viewShadow: {
    width: '80%',
    aspectRatio: 1,
    shadowColor: 'black',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  viewBorder: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 5,
  },
  viewContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  view: {
    width: `${100 / VIEWS_X}%`,
    height: `${100 / VIEWS_Y}%`,
    marginLeft: -0.0001,
  },
  resultText: {
    flexShrink: 1,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 45,
  },
  flex: { flex: 1 },
  bottomView: {
    borderTopRightRadius: 15,
    borderTopLeftRadius: 15,
    elevation: 15,
    shadowColor: 'black',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowRadius: 7,
    shadowOpacity: 0.4,

    paddingHorizontal: 15,
    paddingVertical: 9,
    alignItems: 'center',
    flexDirection: 'row',
  },
})
