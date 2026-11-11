import path from 'node:path'

// TODO: Remove this plugin (and its entry in rn-harness.config.mjs) once a
// react-native-harness release names the running test itself:
// https://github.com/callstackincubator/react-native-harness/pull/204
/**
 * When the app crashes or disconnects in the middle of a test file, Harness
 * only reports that the file failed. This plugin also logs which test was
 * running at that moment, so native crashes can be traced to a single test.
 */
export const runningTestPlugin = () => {
  let runningTest = null

  const report = (ctx, what) => {
    if (runningTest == null) return
    ctx.logger.error(`${what} while running "${runningTest}"`)
    runningTest = null
  }

  return {
    name: 'nitro-running-test',
    hooks: {
      test: {
        started: (ctx) => {
          runningTest = `${path.basename(ctx.file)} › ${ctx.suite} › ${ctx.name}`
        },
        finished: () => {
          runningTest = null
        },
      },
      app: {
        possibleCrash: (ctx) => report(ctx, 'The app crashed'),
      },
      runtime: {
        disconnected: (ctx) =>
          report(
            ctx,
            `The app disconnected (${ctx.reason ?? 'unknown reason'})`
          ),
      },
    },
  }
}
