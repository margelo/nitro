import * as React from 'react'
import {
  Button,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import NativeSegmentedControl, {
  type SegmentedControlProps,
} from '@react-native-segmented-control/segmented-control'
import { NitroModules } from 'react-native-nitro-modules'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '../useColors'
import { KeyboardDismissBackground } from '../components/KeyboardDismissBackground'
import { TestCase, type TestCaseState } from '../components/TestCase'
import {
  collectTests,
  runTest,
  type InAppTest,
  type InAppTestFile,
  type InAppTestResult,
} from '../harness/inAppHarness'

// The library's class declaration uses NativeMethods, which RN 0.88 no longer
// exports. Keep its props while adapting the component type until it is updated.
const SegmentedControl =
  NativeSegmentedControl as unknown as React.ComponentType<SegmentedControlProps>

type TestFilter = 'all' | 'passed' | 'failed' | 'pending'

const FILTER_OPTIONS: TestFilter[] = ['all', 'passed', 'failed', 'pending']

function matchesFilter(state: TestCaseState, filter: TestFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'passed':
      return state === 'passed'
    case 'failed':
      return state === 'failed'
    case 'pending':
      return state === 'idle'
  }
}

function getState(
  result: InAppTestResult | 'running' | undefined
): TestCaseState {
  if (result == null) return 'idle'
  if (result === 'running') return 'running'
  return result.status
}

export function TestsScreen() {
  const safeArea = useSafeAreaInsets()
  const colors = useColors()
  const [files, setFiles] = React.useState<InAppTestFile[]>([])
  const [results, setResults] = React.useState<
    Record<string, InAppTestResult | 'running'>
  >({})
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<TestFilter>('all')

  React.useEffect(() => {
    collectTests().then(setFiles)
  }, [])

  const allTests = React.useMemo(() => files.flatMap((f) => f.tests), [files])
  const loadErrors = React.useMemo(
    () => files.filter((f) => f.loadError != null),
    [files]
  )

  const searchFilteredTests = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (query === '') return allTests
    return allTests.filter((t) =>
      [...t.ancestorTitles, t.name].join(' ').toLowerCase().includes(query)
    )
  }, [allTests, searchQuery])

  const statusFilteredTests = React.useMemo(
    () =>
      searchFilteredTests.filter((t) =>
        matchesFilter(getState(results[t.id]), statusFilter)
      ),
    [searchFilteredTests, results, statusFilter]
  )

  const counts = React.useMemo(() => {
    const states = searchFilteredTests.map((t) => getState(results[t.id]))
    return {
      total: states.length,
      passed: states.filter((s) => s === 'passed').length,
      failed: states.filter((s) => s === 'failed').length,
      pending: states.filter((s) => s === 'idle').length,
      running: states.filter((s) => s === 'running').length,
    }
  }, [searchFilteredTests, results])

  const filterLabels = [
    `All (${counts.total})`,
    `✅ ${counts.passed}`,
    `❌ ${counts.failed}`,
    `📱 ${counts.pending}`,
  ]

  const status = React.useMemo(() => {
    if (counts.running > 0) return '⏳ Running...'
    if (counts.passed === 0 && counts.failed === 0) return '📱 Idle'
    return `✅ ${counts.passed} passed, ❌ ${counts.failed} failed (of ${counts.total})`
  }, [counts])

  const updateResult = React.useCallback(
    (id: string, result: InAppTestResult | 'running') => {
      setResults((r) => ({ ...r, [id]: result }))
    },
    []
  )

  const runSingleTest = React.useCallback(
    async (test: InAppTest) => {
      updateResult(test.id, 'running')
      updateResult(test.id, await runTest(test))
    },
    [updateResult]
  )

  const runAllTests = async () => {
    for (const test of searchFilteredTests) {
      await runSingleTest(test)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: safeArea.top }]}>
      <KeyboardDismissBackground />

      <View style={styles.titleRow}>
        <Text style={[styles.header, { color: colors.text }]}>Tests</Text>
        <View style={styles.flex} />
        <Text style={[styles.buildTypeText, { color: colors.text }]}>
          {NitroModules.buildType}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            { color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Search tests (e.g. TestObjectCpp)..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <Text
            style={[styles.searchResultsText, { color: colors.textSecondary }]}
          >
            Showing {searchFilteredTests.length} of {allTests.length} tests
          </Text>
        )}
      </View>

      <View style={styles.filterContainer}>
        <SegmentedControl
          style={styles.filterSegmentedControl}
          values={filterLabels}
          selectedIndex={FILTER_OPTIONS.indexOf(statusFilter)}
          onChange={({ nativeEvent: { selectedSegmentIndex } }) => {
            setStatusFilter(FILTER_OPTIONS[selectedSegmentIndex]!)
          }}
        />
      </View>

      {loadErrors.map((f) => (
        <Text key={f.file} style={styles.loadError}>
          ❌ Failed to load {f.file}: {f.loadError}
        </Text>
      ))}

      <FlatList
        data={statusFilteredTests}
        keyExtractor={(test) => test.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={{ color: colors.textSecondary }}>
              Nothing selected.
            </Text>
          </View>
        }
        renderItem={({ item: test, index }) => (
          <TestCase
            test={test}
            result={results[test.id]}
            onRunPressed={() => runSingleTest(test)}
            isOdd={index % 2 === 0}
          />
        )}
      />

      <View style={[styles.bottomView, { backgroundColor: colors.background }]}>
        <Text
          style={[styles.resultText, { color: colors.text }]}
          numberOfLines={2}
        >
          {status}
        </Text>
        <View style={styles.flex} />
        <Button title="Run all tests" onPress={runAllTests} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    paddingBottom: 15,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  buildTypeText: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      macos: 'Menlo',
      android: 'monospace',
    }),
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginHorizontal: 15,
    marginBottom: 10,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  searchResultsText: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  filterContainer: {
    marginHorizontal: 15,
    marginBottom: 10,
  },
  filterSegmentedControl: {
    height: 32,
  },
  loadError: {
    marginHorizontal: 15,
    marginBottom: 10,
    color: 'red',
  },
  resultText: {
    flexShrink: 1,
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
