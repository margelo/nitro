import { expect } from 'chai'
import { casesForTestObjects, recordCallback, rejection, waitFor, withTimeout } from './utils/cases'

// Each native implementation calls these callbacks with an explicit calling convention:
// `callSync` runs a JS callback before the native method returns, while `callAsync`
// and `callAndForget` schedule it on the JS thread.
const CALLBACK_TIMEOUT = { timeout: 2000 }

export const cases = {
  ...casesForTestObjects('Callback conventions', {
    'callSync runs the JS callback before the native method returns': (testObject) => {
      const order: string[] = ['before']
      testObject.callSyncCallback(21, (value) => {
        order.push(`callback(${value})`)
      })
      order.push('after')
      expect(order).to.deep.equal(['before', 'callback(21)', 'after'])
    },

    'callSync throws the JS error to the native caller': (testObject) => {
      expect(() =>
        testObject.callSyncCallback(21, () => {
          throw new Error('callSync failed')
        })
      ).to.throw('callSync failed')
    },

    'callAsync runs the JS callback after the native method returns': async (testObject) => {
      const callback = recordCallback((value: number) => value * 2)
      const promise = testObject.callAsyncCallback(21, callback)
      expect(callback.calls).to.have.length(0)
      const result = await withTimeout(promise)
      expect(result).to.equal(42)
      expect(callback.calls).to.deep.equal([[21]])
    },

    'callAsync rejects when the JS callback throws': async (testObject) => {
      const promise = testObject.callAsyncCallback(21, () => {
        throw new Error('callAsync failed')
      })
      const error = await rejection(withTimeout(promise))
      expect(error).to.be.instanceOf(Error).and.have.property('message').that.include('callAsync failed')
    },

    'callAsync of a void callback resolves after the JS callback ran': async (testObject) => {
      const callback = recordCallback()
      const promise = testObject.callAsyncVoidCallback(callback)
      expect(callback.calls).to.have.length(0)
      const result = await withTimeout(promise)
      expect(result).to.equal(undefined)
      expect(callback.calls).to.have.length(1)
    },

    'callAsync of a void callback rejects when the JS callback throws': async (testObject) => {
      const promise = testObject.callAsyncVoidCallback(() => {
        throw new Error('void callAsync failed')
      })
      const error = await rejection(withTimeout(promise))
      expect(error).to.be.instanceOf(Error).and.have.property('message').that.include('void callAsync failed')
    },

    'callAsync converts boolean arguments and results': async (testObject) => {
      const callback = recordCallback((value: boolean) => !value)
      const promise = testObject.callAsyncBooleanCallback(true, callback)
      expect(callback.calls).to.have.length(0)
      const result = await withTimeout(promise)
      expect(result).to.equal(false)
      expect(callback.calls).to.deep.equal([[true]])
    },

    'callAsync can be awaited from a native background task': async (testObject) => {
      const callback = recordCallback((value: number) => value * 2)
      const promise = testObject.awaitAsyncCallback(20, callback)
      expect(callback.calls).to.have.length(0)
      const result = await withTimeout(promise)
      expect(result).to.equal(41)
      expect(callback.calls).to.deep.equal([[20]])
    },

    'callAsync awaited from a native background task rejects when the JS callback throws': async (testObject) => {
      const promise = testObject.awaitAsyncCallback(20, () => {
        throw new Error('awaited callAsync failed')
      })
      const error = await rejection(withTimeout(promise))
      expect(error).to.be.instanceOf(Error).and.have.property('message').that.include('awaited callAsync failed')
    },

    'callAndForget runs the JS callback after the native method returns': async (testObject) => {
      const callback = recordCallback((value: number) => value * 2)
      testObject.callAndForgetCallback(21, callback)
      expect(callback.calls).to.have.length(0)
      await waitFor(() => expect(callback.calls).to.deep.equal([[21]]), CALLBACK_TIMEOUT)
    },

    'callAndForget keeps working after the JS callback throws': async (testObject) => {
      const throwing = recordCallback(() => {
        throw new Error('callAndForget failed')
      })
      expect(() => testObject.callAndForgetCallback(1, throwing)).not.to.throw()
      await waitFor(() => expect(throwing.calls).to.have.length(1), CALLBACK_TIMEOUT)

      // The error goes to the global error handler, so later calls still run.
      const next = recordCallback((value: number) => value)
      testObject.callAndForgetCallback(2, next)
      await waitFor(() => expect(next.calls).to.deep.equal([[2]]), CALLBACK_TIMEOUT)
    },

    'callAsync of a native callback resolves with its result': async (testObject) => {
      const result = await withTimeout(testObject.callNativeCallbackAsync(21))
      expect(result).to.equal(42)
    },

    'callAsync of a throwing native callback rejects': async (testObject) => {
      const promise = testObject.callThrowingNativeCallbackAsync('native callAsync failed')
      const error = await rejection(withTimeout(promise))
      expect(error).to.be.instanceOf(Error).and.have.property('message').that.include('native callAsync failed')
    },

    'callAndForget of a throwing native callback does not throw': (testObject) => {
      expect(() => testObject.callThrowingNativeCallbackAndForget('native callAndForget failed')).not.to.throw()
    },

    'InlineCallback can be called inline and then escaped': async (testObject) => {
      const callback = recordCallback((value: number) => value + 1)
      const promise = testObject.callInlineCallbackThenEscape(1, callback)
      expect(callback.calls).to.deep.equal([[1]])
      const result = await withTimeout(promise)
      expect(result).to.equal(3)
      expect(callback.calls).to.deep.equal([[1], [2]])
    },
  }),
}
