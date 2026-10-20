const path = require('path')

module.exports = {
  dependencies: {
    'nitro-core': {
      // RNCLI probes native folders before applying platform exclusions.
      root: path.dirname(require.resolve('nitro-core')),
      platforms: {
        ios: null,
        android: null,
      },
    },
  },
}
