import { NativeModules, Platform } from 'react-native'

const BULLET_POINT = '\n* '

function messageWithSuggestions(
  message: string,
  suggestions: string[]
): string {
  return message + BULLET_POINT + suggestions.join(BULLET_POINT)
}

function getFrameworkType(): 'react-native' | 'expo' | 'expo-go' {
  // check if Expo
  const ExpoConstants =
    NativeModules.NativeUnimoduleProxy?.modulesConstants?.ExponentConstants
  if (ExpoConstants != null) {
    if (ExpoConstants.appOwnership === 'expo') {
      // We're running Expo Go
      return 'expo-go'
    } else {
      // We're running Expo bare / standalone
      return 'expo'
    }
  }
  return 'react-native'
}

export class ModuleNotFoundError extends Error {
  constructor(cause?: unknown) {
    const framework = getFrameworkType()
    if (framework === 'expo-go') {
      super(
        'NitroModules are not supported in Expo Go! Use EAS (`expo prebuild`) or eject to a bare workflow instead.'
      )
      return
    }

    const message =
      'Failed to get NitroModules: The native "NitroModules" TurboModule could not be found.'
    const suggestions: string[] = []
    suggestions.push(
      'Make sure react-native-nitro-modules/NitroModules is correctly autolinked (run `npx react-native config` to verify)'
    )
    suggestions.push(
      'Make sure React Native Codegen generated the "NativeNitroModules" specs.'
    )
    suggestions.push('Make sure you are using react-native 0.88.0 or higher.')
    suggestions.push('Make sure you rebuilt the app.')
    if (framework === 'expo') {
      suggestions.push('Make sure you ran `expo prebuild`.')
    }
    switch (Platform.OS) {
      case 'ios':
      case 'macos':
        suggestions.push(
          'Make sure you ran `npx react-native spm` in your app directory.'
        )
        break
      case 'android':
        suggestions.push('Make sure gradle is synced.')
        break
      default:
        throw new Error(`NitroModules are not yet supported on ${Platform.OS}!`)
    }

    const error = messageWithSuggestions(message, suggestions)
    super(error, { cause: cause })
  }
}
