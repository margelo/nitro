import { NativeComponentRegistry, type HostComponent } from 'react-native'

/** Shared attribute configuration for generated Nitro view props. */
export const NitroViewProp = {
  // Compare opaque native objects and callbacks by identity.
  diff(previous: unknown, next: unknown): boolean {
    return previous !== next
  },
  // React Native otherwise converts function props to event-marker booleans.
  process(value: unknown): unknown {
    return value
  },
}

/** Registers a native view with its generated Fabric attributes. */
export function getHostComponent<Props extends object>(
  name: string,
  validAttributes: Readonly<Record<string, typeof NitroViewProp>>
): HostComponent<Props> {
  return NativeComponentRegistry.get(name, () => ({
    uiViewClassName: name,
    validAttributes: validAttributes,
  }))
}
