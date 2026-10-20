import { useColorScheme } from 'react-native'

const colors = {
  light: {
    background: 'rgb(239, 249, 255)',
    foreground: 'rgb(36, 42, 63)',
    text: 'rgb(36, 42, 63)',
  },
  dark: {
    background: 'rgb(17, 22, 37)',
    foreground: 'rgb(189, 206, 219)',
    text: 'rgb(189, 206, 219)',
  },
}

export function useColors() {
  return useColorScheme() === 'dark' ? colors.dark : colors.light
}
