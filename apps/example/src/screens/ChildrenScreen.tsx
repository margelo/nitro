import * as React from 'react'
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ChildrenContainerTestView,
  ChildrenTestView,
  TestView,
} from 'react-native-nitro-test'
import { callback } from 'react-native-nitro-modules'
import { useColors } from '../useColors'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.ReactElement {
  const colors = useColors()
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {children}
    </View>
  )
}

export function ChildrenScreen(): React.ReactElement {
  const safeArea = useSafeAreaInsets()
  const colors = useColors()
  const [items, setItems] = React.useState(['A', 'B'])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: safeArea.top + 15, paddingBottom: safeArea.bottom + 30 },
      ]}
    >
      <Text style={[styles.header, { color: colors.foreground }]}>
        Nitro View children
      </Text>

      <Section title="Children render on top of the native View">
        <ChildrenTestView style={styles.box} isBlue={true}>
          <Text style={styles.label}>Hello from React</Text>
        </ChildrenTestView>
      </Section>

      <Section title="Yoga lays them out — padding, border, radius">
        <ChildrenTestView style={styles.paddedBox} isBlue={true}>
          <View style={styles.filler}>
            <Text style={styles.label}>flex: 1</Text>
          </View>
        </ChildrenTestView>
      </Section>

      <Section title="Nested Nitro Views">
        <ChildrenTestView style={styles.paddedBox} isBlue={true}>
          <ChildrenTestView style={styles.innerBox} isBlue={false}>
            <Text style={styles.label}>inner</Text>
          </ChildrenTestView>
          <TestView
            style={styles.leaf}
            isBlue={false}
            hasBeenCalled={false}
            colorScheme="dark"
            someCallback={callback(() => {})}
          />
        </ChildrenTestView>
      </Section>

      <Section title="childrenContainer — children live in a sub-view">
        <ChildrenContainerTestView style={styles.box} isBlue={false}>
          <Text style={styles.label}>mounted into the container</Text>
        </ChildrenContainerTestView>
      </Section>

      <Section title={`Reconciliation — ${items.length} children`}>
        <ChildrenTestView style={styles.listBox} isBlue={true}>
          {items.map((item) => (
            <View key={item} style={styles.row}>
              <Text style={styles.label}>{item}</Text>
            </View>
          ))}
        </ChildrenTestView>
        <View style={styles.buttons}>
          <Button
            title="Add"
            onPress={() =>
              setItems((i) => [...i, String.fromCharCode(65 + i.length)])
            }
          />
          <Button
            title="Remove"
            onPress={() => setItems((i) => i.slice(0, -1))}
          />
          <Button
            title="Reverse"
            onPress={() => setItems((i) => [...i].reverse())}
          />
        </View>
      </Section>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 15 },
  header: { fontSize: 26, fontWeight: 'bold', paddingBottom: 10 },
  section: { paddingVertical: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '600', paddingBottom: 8 },
  box: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    overflow: 'hidden',
  },
  paddedBox: {
    height: 110,
    padding: 12,
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  innerBox: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaf: { width: 40, marginLeft: 10, borderRadius: 8, overflow: 'hidden' },
  filler: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listBox: { padding: 8, borderRadius: 10, overflow: 'hidden' },
  row: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  label: { color: 'white', fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 12, paddingTop: 8 },
})
