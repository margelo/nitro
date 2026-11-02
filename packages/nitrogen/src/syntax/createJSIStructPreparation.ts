import { indent } from '../utils.js'

interface JSIStructPreparationOptions {
  properties: readonly { name: string; converter: string }[]
}

/** Snapshots the fields checked during variant selection before decoding the matched struct. */
export function createJSIStructPreparation({ properties }: JSIStructPreparationOptions): {
  preparedType: string
  prepareFromJSI: string
} {
  const checks = properties.map(({ name, converter }, index) => {
    const field = `field_${index}`
    return `
auto ${field} = object.getProperty(runtime, PropNameIDCache::get(runtime, "${name}"));
if (!${converter}::canConvert(runtime, ${field})) return std::nullopt;
`.trim()
  })
  const fieldValues = properties.map((_, index) => `std::move(field_${index})`)
  const prepareFromJSI = `
if (!value.isObject()) return std::nullopt;
auto object = value.getObject(runtime);
if (!isPlainObject(runtime, object)) return std::nullopt;
${indent(checks.join('\n'), '')}
return Prepared{${fieldValues.join(', ')}};
`.trim()
  return {
    preparedType: `std::array<jsi::Value, ${properties.length}>`,
    prepareFromJSI: prepareFromJSI,
  }
}
