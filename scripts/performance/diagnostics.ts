import { appendFile, writeFile } from 'node:fs/promises'

/** A failed or unavailable diagnostic command is itself useful evidence. */
export async function commandOutput(
  executable: string,
  argumentsList: string[],
  timeoutMs = 15_000
) {
  const startedAt = new Date().toISOString()
  let timedOut = false
  let truncated = false
  try {
    const child = Bun.spawn([executable, ...argumentsList], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdoutReader = child.stdout.getReader()
    const stderrReader = child.stderr.getReader()
    async function readOutput(reader: typeof stdoutReader) {
      const decoder = new TextDecoder()
      let remaining = 2 * 1024 * 1024
      let output = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        output += decoder.decode(value.subarray(0, remaining), { stream: true })
        remaining -= value.length
        if (remaining < 0) {
          truncated = true
          child.kill('SIGKILL')
          await reader.cancel()
          break
        }
      }
      return output + decoder.decode()
    }
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
      // A subprocess may have exited while its descendants still own the pipes.
      Promise.allSettled([stdoutReader.cancel(), stderrReader.cancel()])
    }, timeoutMs)
    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        readOutput(stdoutReader),
        readOutput(stderrReader),
      ])
      return {
        command: [executable, ...argumentsList],
        startedAt,
        exitCode,
        signal: child.signalCode,
        timeoutMs,
        timedOut,
        truncated,
        stdout,
        stderr,
      }
    } finally {
      clearTimeout(timer)
      child.kill('SIGKILL')
      await Promise.allSettled([stdoutReader.cancel(), stderrReader.cancel()])
      await child.exited
    }
  } catch (error) {
    return {
      command: [executable, ...argumentsList],
      startedAt,
      exitCode: null,
      signal: null,
      timeoutMs,
      timedOut,
      truncated,
      stdout: '',
      stderr: String(error),
    }
  }
}

export async function saveAndroidFailure(
  deviceId: string,
  appId: string,
  output: string,
  error: unknown
): Promise<void> {
  const failureLog = output.replace(/\.json$/, '.failure.log')
  try {
    // Write the original failure first, even if ADB has disappeared or hangs.
    await writeFile(
      failureLog,
      `Benchmark failure: ${error instanceof Error ? error.stack : String(error)}\n`
    )
    for (const argumentsList of [
      ['devices', '-l'],
      ['-s', deviceId, 'logcat', '-d', '-t', '1000'],
      ['-s', deviceId, 'shell', 'dumpsys', 'activity', 'exit-info', appId],
    ]) {
      const result = await commandOutput('adb', argumentsList)
      const diagnostic = `${JSON.stringify(result, null, 2)}\n`
      await appendFile(failureLog, diagnostic)
      console.error(diagnostic)
    }
  } catch (diagnosticError) {
    // Diagnostics must never replace the benchmark's original exception.
    console.error(`Could not save Android diagnostics: ${diagnosticError}`)
  }
}
