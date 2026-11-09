require 'fileutils'
require 'json'
require 'pathname'

module Nitro
  # TODO: Remove CocoaPods support once React Native defaults to Swift Package Manager.
  # Remove this helper, its companion pods and SimdUTF specs, and the Podfile hooks.
  # Remove CocoaPods build configuration from runtime, template and test podspecs.
  # Stop publishing cocoapods.rb and any CocoaPods-only podspecs through package.json files.
  # Remove createCocoaPodsConfig.ts and generated apple/*+autolinking.json files.
  # Remove build_cocoapods from .github/workflows/build-ios-release.yml.
  # Remove CocoaPods setup and simplify Apple package-manager instructions in docs/ and package READMEs.
  # Drop Nitrogen's pod install hint in packages/nitrogen/src/index.ts.
  # Keep discovery-only podspec/Podfile metadata while React Native CLI requires it.
  module CocoaPods
    SOURCE_EXTENSIONS = '*.{h,hh,hpp,hxx,c,cc,cpp,cxx,m,mm}'.freeze
    SIMDUTF_VERSION = '1.0.1'.freeze

    class << self
      def configure_runtime(spec)
        directory = __dir__
        register(spec, directory, 'NitroModules', [], runtime: true)
      end

      def configure_library(spec, generated_directory: 'nitrogen/generated', swift_sources: ['apple'], cxx_sources: ['cpp'])
        # CocoaPods evaluates a podspec with its directory as the working directory.
        directory = File.realpath(Dir.pwd)
        configuration_files = Dir.glob(File.join(directory, generated_directory, 'apple', '*+autolinking.json'))
        unless configuration_files.length == 1
          raise "Run Nitrogen before installing #{spec.name}: expected one Apple autolinking configuration in #{generated_directory}/apple."
        end
        configuration = JSON.parse(File.read(configuration_files.first))
        module_name = configuration.fetch('moduleName')
        dependencies = configuration.fetch('dependencies')
        unless module_name.is_a?(String) && dependencies.is_a?(Array) && dependencies.all? { |name| name.is_a?(String) }
          raise "Invalid Nitrogen CocoaPods configuration for #{spec.name}. Run Nitrogen again."
        end
        register(spec, directory, module_name, dependencies,
                 generated_directory: generated_directory, swift_sources: swift_sources, cxx_sources: cxx_sources)
      end

      def install(podfile, frameworks: false)
        libraries = @libraries || {}
        unless libraries.key?('NitroModules')
          raise 'Call use_nitro_modules! after use_native_modules! so Nitro podspecs have been loaded.'
        end
        libraries.each_value do |library|
          validate_sources(library.fetch(:spec))
          library.fetch(:dependencies).each do |dependency|
            unless libraries.key?(dependency)
              raise "#{library.fetch(:module_name)} references Nitro module #{dependency}, but its podspec was not autolinked. Add the npm package providing #{dependency} to the app's dependencies."
            end
          end
        end
        @framework_modes ||= {}
        if @framework_modes.key?(podfile) && @framework_modes.fetch(podfile) != frameworks
          raise 'Use the same use_frameworks! setting for every target that calls use_nitro_modules!. Mixed library and framework linkage in one Podfile is not supported.'
        end
        @framework_modes[podfile] = frameworks
        output = File.join(Pod::Config.instance.installation_root, 'build', 'generated', 'nitro')
        libraries.each_value do |library|
          companion_specs(library, frameworks: frameworks).each do |spec|
            directory = File.join(output, spec.name)
            FileUtils.mkdir_p(directory)
            materialize_sources(spec, directory, library.fetch(:directory))
            materialize_module_map(spec, directory, library.fetch(:directory))
            File.write(File.join(directory, "#{spec.name}.podspec.json"), spec.to_pretty_json)
            podfile.pod(spec.name, :path => directory)
          end
        end
        simdutf_specs.each do |spec|
          directory = File.join(output, spec.name)
          FileUtils.mkdir_p(directory)
          file = File.join(directory, "#{spec.name}.podspec.json")
          File.write(file, spec.to_pretty_json)
          podfile.pod(spec.name, :podspec => file)
        end
      end

      def post_install(installer)
        swift_pods = (@libraries || {}).keys.map { |name| "#{name}Swift" }
        projects = [installer.pods_project, *Array(installer.generated_projects)].compact.uniq
        projects.flat_map(&:targets).each do |target|
          next unless swift_pods.any? { |name| target.name == name || target.name.start_with?("#{name}-") }
          phase = target.shell_script_build_phases.find { |build_phase| build_phase.name == 'Copy generated compatibility header' }
          if phase
            # Swift imports the Swift module, and AppleCxx supplies its native types.
            # Only the private C++ bridge may include the generated Swift C++ header.
            phase.shell_script = phase.shell_script.lines.reject do |line|
              line.lstrip.start_with?('printf ') && line.include?('${PRODUCT_MODULE_NAME}.Swift')
            end.join
          elsif target.product_type == 'com.apple.product-type.framework'
            # Xcode otherwise adds the C++ Swift header as a Clang submodule of
            # the framework. Keep it outside the public framework headers instead.
            target.build_configurations.each do |configuration|
              configuration.build_settings['SWIFT_INSTALL_OBJC_HEADER'] = 'NO'
            end
            phase = target.shell_script_build_phases.find { |build_phase| build_phase.name == 'Copy Nitro Swift C++ header' }
            phase ||= target.new_shell_script_build_phase('Copy Nitro Swift C++ header')
            phase.shell_script = <<~SH
              ditto "${DERIVED_SOURCES_DIR}/${PRODUCT_MODULE_NAME}-Swift.h" "${BUILT_PRODUCTS_DIR}/Swift Compatibility Header/${PRODUCT_MODULE_NAME}-Swift.h"
            SH
            phase.input_paths = ['${DERIVED_SOURCES_DIR}/${PRODUCT_MODULE_NAME}-Swift.h']
            phase.output_paths = ['${BUILT_PRODUCTS_DIR}/Swift Compatibility Header/${PRODUCT_MODULE_NAME}-Swift.h']
          end
        end
      end

      private

      def register(spec, directory, module_name, dependencies, **options)
        validate_sources(spec)
        @libraries ||= {}
        @libraries[module_name] = {
          :spec => spec, :directory => File.expand_path(directory), :module_name => module_name,
          :dependencies => dependencies, **options,
        }
        %W[#{module_name}Cxx #{module_name}AppleCxx #{module_name}Swift #{module_name}SwiftBridge].each do |name|
          spec.dependency(name, spec.version.to_s)
        end
        spec.dependency('NitroModulesReactNative', spec.version.to_s) if options[:runtime]
      end

      def base_spec(library, name, module_name = name)
        root = library.fetch(:spec)
        Pod::Spec.new do |spec|
          spec.name = name
          spec.module_name = module_name
          spec.version = root.version
          spec.summary = root.summary
          spec.homepage = root.homepage
          spec.license = root.license
          spec.authors = root.authors
          spec.source = root.source
          spec.platforms = root.available_platforms.to_h { |platform| [platform.name, platform.deployment_target.to_s] }
          spec.swift_version = '6.0'
          module_names = ['NitroModules', library.fetch(:module_name)] + library.fetch(:dependencies)
          internal_dependencies = module_names.flat_map { |name| [name, "#{name}Cxx", "#{name}AppleCxx", "#{name}Swift", "#{name}SwiftBridge", "#{name}ReactNative"] }
          copy_build_attributes(root, spec, internal_dependencies)
          root.attributes_hash.fetch('dependencies', {}).each do |dependency, requirements|
            next if internal_dependencies.include?(dependency)
            spec.dependency(dependency, *requirements)
          end
          unless library[:runtime]
            # SwiftPM exposes each Nitro product's complete native module graph.
            spec.dependency('NitroModules')
            library.fetch(:dependencies).each do |dependency|
              dependency_library = (@libraries || {})[dependency]
              dependency_name = dependency_library ? dependency_library.fetch(:spec).name : dependency
              spec.dependency(dependency_name)
            end
          end
          merge_build_settings(spec, {
            'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
            'DEFINES_MODULE' => 'YES',
            'SWIFT_OBJC_INTEROP_MODE' => 'objcxx',
            'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) NITRO_JSI_HAS_FAST_UTF16=false',
            'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -Wno-nullability-extension',
            'HEADER_SEARCH_PATHS' => '$(inherited) ' + native_framework_header_paths(module_names, library[:runtime]).join(' '),
          })
        end
      end

      def companion_specs(library, frameworks: false)
        validate_sources(library.fetch(:spec))
        name = library.fetch(:module_name)
        dependencies = library.fetch(:dependencies)
        if library[:runtime]
          cpp = 'cpp/core'
          apple = 'apple/core'
          shared_sources = ["#{cpp}/src"]
          swift_sources = ["#{apple}/core", "#{apple}/utils", 'apple/views']
          bridge_sources = ["#{apple}/swift-bridge/src"]
          cpp_headers = "#{cpp}/include"
          apple_headers = "#{apple}/include"
          bridge_headers = "#{apple}/swift-bridge/include"
        else
          generated = library.fetch(:generated_directory)
          apple = "#{generated}/apple"
          shared_sources = ["#{generated}/shared/c++"] + library.fetch(:cxx_sources)
          swift_sources = ["#{apple}/swift"] + library.fetch(:swift_sources)
          bridge_sources = ["#{apple}/c++", "#{apple}/#{name}-Swift-Cxx-Bridge.cpp", "#{apple}/#{name}Autolinking.cpp", "#{apple}/#{name}Autolinking.mm"]
          cpp_headers = "#{generated}/shared/c++/include"
          apple_headers = "#{apple}/#{name}AppleCxx/include"
          bridge_headers = "#{apple}/c++/include"
        end

        cxx = base_spec(library, "#{name}Cxx")
        cxx.source_files = source_patterns(shared_sources) + ["sources/#{cpp_headers}/**/*.{h,hpp}"]
        cxx.public_header_files = "sources/#{cpp_headers}/**/*.{h,hpp}"
        cxx.header_mappings_dir = header_mapping_directory(library, cpp_headers, frameworks)
        cxx.module_map = "sources/#{cpp_headers}/module.modulemap"
        cxx.dependency('React-jsi')
        dependencies.each { |dependency| cxx.dependency("#{dependency}Cxx") }
        unless library[:runtime]
          cxx.dependency('NitroModulesCxx')
          install_modules_dependencies(cxx)
        end
        add_source_search_paths(cxx, library, shared_sources)

        apple_cxx = base_spec(library, "#{name}AppleCxx")
        apple_cxx.source_files = source_patterns([apple_headers, library[:runtime] ? "#{apple}/src" : "#{apple}/#{name}AppleCxx"])
        apple_cxx.public_header_files = "sources/#{apple_headers}/**/*.{h,hpp}"
        apple_cxx.header_mappings_dir = header_mapping_directory(library, apple_headers, frameworks)
        apple_cxx.module_map = "sources/#{apple_headers}/module.modulemap"
        apple_cxx.dependency("#{name}Cxx")
        apple_cxx.dependency('NitroModulesAppleCxx') unless library[:runtime]
        dependencies.each { |dependency| apple_cxx.dependency("#{dependency}AppleCxx") }
        add_source_search_paths(apple_cxx, library, shared_sources)

        swift = base_spec(library, "#{name}Swift", name)
        swift.source_files = swift_sources.map { |source| File.extname(source) == '.swift' ? "sources/#{source}" : "sources/#{source}/**/*.swift" }
        swift.dependency("#{name}AppleCxx")
        swift.dependency('NitroModulesSwift') unless library[:runtime]
        dependencies.each { |dependency| swift.dependency("#{dependency}Swift") }
        exposed_modules = library[:runtime] ? [] : ['NitroModules'] + dependencies
        # TODO: Remove this include-order workaround once our minimum Swift includes a fix for
        # https://github.com/swiftlang/swift/issues/94116. CocoaPods' header aliases crash the importer.
        core_headers = File.realpath(File.join(__dir__, 'cpp/core/include'))
        merge_build_settings(swift, {
          'OTHER_SWIFT_FLAGS' => %Q($(inherited) -Xcc -I"#{core_headers}" -enable-upcoming-feature InternalImportsByDefault ) + \
            '-Xfrontend -clang-header-expose-decls=has-expose-attr-or-stdlib ' + exposed_modules.map { |dependency| "-Xfrontend -clang-header-expose-module -Xfrontend #{dependency}=#{dependency}-Swift.h" }.join(' '),
          'HEADER_SEARCH_PATHS' => '$(inherited) ' + swift_header_paths(exposed_modules).join(' ')
        })
        if library[:runtime]
          merge_build_settings(swift, { 'OTHER_SWIFT_FLAGS' => '$(inherited) -enable-upcoming-feature MemberImportVisibility -enable-upcoming-feature ApproachableConcurrency' })
        end
        swift.dependency('SimdUTF', SIMDUTF_VERSION) if library[:runtime]

        bridge = base_spec(library, "#{name}SwiftBridge")
        bridge.source_files = source_patterns(bridge_sources) + ["sources/#{bridge_headers}/**/*.{h,hpp}"]
        bridge.public_header_files = "sources/#{bridge_headers}/**/*.{h,hpp}"
        bridge.header_mappings_dir = header_mapping_directory(library, bridge_headers, frameworks)
        bridge.module_map = "sources/#{bridge_headers}/module.modulemap"
        bridge.dependency("#{name}Swift")
        bridge.dependency("#{name}AppleCxx")
        unless library[:runtime]
          bridge.dependency('NitroModulesSwiftBridge')
          install_modules_dependencies(bridge)
        end
        dependencies.each { |dependency| bridge.dependency("#{dependency}SwiftBridge") }
        merge_build_settings(bridge, {
          'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -Wno-nullability-extension -fno-modules',
          'HEADER_SEARCH_PATHS' => '$(inherited) ' + swift_header_paths([name] + exposed_modules).join(' ')
        })
        add_source_search_paths(bridge, library, shared_sources)

        specs = [cxx, apple_cxx, swift, bridge]
        if library[:runtime]
          react_native = base_spec(library, 'NitroModulesReactNative')
          react_native.source_files = source_patterns(['apple/src', 'cpp/src', 'include'])
          react_native.public_header_files = 'sources/include/**/*.{h,hpp}'
          react_native.header_mappings_dir = header_mapping_directory(library, 'include', frameworks)
          react_native.module_map = 'sources/include/module.modulemap'
          react_native.dependency('NitroModulesCxx')
          react_native.dependency('NitroModulesAppleCxx')
          install_modules_dependencies(react_native)
          specs << react_native
        end
        specs
      end

      def header_mapping_directory(library, directory, frameworks)
        # Framework copy phases resolve symlinked files; static header maps keep
        # the paths returned by CocoaPods' source scanner.
        frameworks ? File.realpath(File.join(library.fetch(:directory), directory)) : "sources/#{directory}"
      end

      def validate_sources(spec)
        scopes = [spec.attributes_hash] + spec.available_platforms.map { |platform| spec.attributes_hash.fetch(platform.name.to_s, {}) }
        if scopes.any? { |attributes| attributes.key?('source_files') }
          raise "Remove source_files from #{spec.name}'s podspec and pass swift_sources/cxx_sources to Nitro::CocoaPods.configure_library instead. Nitro builds those sources in separate Swift and C++ pods."
        end
      end

      def native_framework_header_paths(modules, runtime)
        pods = modules.uniq.flat_map { |name| ["#{name}Cxx", "#{name}AppleCxx", "#{name}SwiftBridge"] }
        pods << 'NitroModulesReactNative' if runtime
        pods.map { |name| %Q("$(PODS_CONFIGURATION_BUILD_DIR)/#{name}/#{name}.framework/Headers") }
      end

      def copy_build_attributes(root, spec, internal_dependencies)
        keys = %w[frameworks weak_frameworks libraries compiler_flags requires_arc static_framework]
        keys.each do |key|
          value = root.attributes_hash[key]
          spec.attributes_hash[key] = value if value
        end
        settings = rebase_source_paths(root.attributes_hash.fetch('pod_target_xcconfig', {}))
        spec.pod_target_xcconfig = settings
        excludes = root.attributes_hash['exclude_files']
        spec.exclude_files = Array(excludes).map { |path| "sources/#{path}" } if excludes
        root.available_platforms.each do |platform|
          attributes = root.attributes_hash[platform.name.to_s]
          next unless attributes
          selected = attributes.select { |key, _| keys.include?(key) }
          platform_settings = attributes['pod_target_xcconfig']
          if platform_settings
            selected['pod_target_xcconfig'] = merge_xcconfigs(settings, rebase_source_paths(platform_settings))
          end
          platform_excludes = attributes['exclude_files']
          selected['exclude_files'] = Array(platform_excludes).map { |path| "sources/#{path}" } if platform_excludes
          dependencies = attributes.fetch('dependencies', {}).reject { |name, _| internal_dependencies.include?(name) }
          selected['dependencies'] = dependencies unless dependencies.empty?
          spec.attributes_hash[platform.name.to_s] = selected unless selected.empty?
        end
      end

      def rebase_source_paths(settings)
        settings.transform_values do |value|
          value.gsub('$(PODS_TARGET_SRCROOT)', '$(PODS_TARGET_SRCROOT)/sources').gsub('${PODS_TARGET_SRCROOT}', '${PODS_TARGET_SRCROOT}/sources')
        end
      end

      def merge_xcconfigs(current, additions)
        current.merge(additions) do |_key, previous, value|
          value.start_with?('$(inherited)') ? "#{previous} #{value.delete_prefix('$(inherited)').strip}" : value
        end
      end

      def merge_build_settings(spec, additions)
        current = spec.attributes_hash.fetch('pod_target_xcconfig', {})
        spec.pod_target_xcconfig = merge_xcconfigs(current, additions)
        spec.available_platforms.each do |platform|
          attributes = spec.attributes_hash[platform.name.to_s]
          next unless attributes && attributes['pod_target_xcconfig']
          attributes['pod_target_xcconfig'] = merge_xcconfigs(attributes['pod_target_xcconfig'], additions)
        end
      end

      def source_patterns(paths)
        paths.map do |path|
          if %w[.h .hh .hpp .hxx .c .cc .cpp .cxx .m .mm].include?(File.extname(path))
            "sources/#{path}"
          else
            "sources/#{path}/**/#{SOURCE_EXTENSIONS}"
          end
        end
      end

      def add_source_search_paths(spec, library, sources)
        paths = sources.filter_map do |source|
          path = File.join(library.fetch(:directory), source)
          next unless File.exist?(path)
          directory = File.directory?(path) ? path : File.dirname(path)
          %Q("#{directory}")
        end
        merge_build_settings(spec, { 'HEADER_SEARCH_PATHS' => ['$(inherited)', *paths].join(' ') })
      end

      def swift_header_paths(modules)
        modules.flat_map do |name|
          [
            %Q("$(PODS_CONFIGURATION_BUILD_DIR)/#{name}Swift/Swift Compatibility Header"),
            %Q("$(PODS_CONFIGURATION_BUILD_DIR)/#{name}Swift/#{name}.framework/Headers"),
          ]
        end
      end

      def materialize_sources(spec, directory, source_directory)
        # CocoaPods does not traverse symlinked directories when finding sources.
        # Real directories containing file symlinks preserve live edits to npm sources.
        source_root = File.join(directory, 'sources')
        FileUtils.rm_rf(source_root)
        FileUtils.mkdir_p(source_root)
        patterns = Array(spec.attributes_hash['source_files']).dup
        module_map = spec.attributes_hash['module_map']
        patterns << module_map if module_map
        paths = patterns.flat_map do |pattern|
          Dir.glob(File.join(source_directory, pattern.delete_prefix('sources/')))
        end
        paths.uniq.each do |source|
          next unless File.file?(source)
          relative = Pathname(source).relative_path_from(Pathname(source_directory)).to_s
          destination = File.join(source_root, relative)
          FileUtils.mkdir_p(File.dirname(destination))
          File.symlink(source, destination)
        end
      end

      def materialize_module_map(spec, directory, source_directory)
        module_map = spec.attributes_hash['module_map']
        return unless module_map
        source_file = File.join(directory, module_map)
        if File.file?(source_file)
          # Refer to the canonical map instead of redeclaring its module. Clang
          # can discover the original map through the source headers as well.
          original_map = File.realpath(source_file)
          contents = %Q(extern module #{spec.module_name} "#{original_map}"\n)
        else
          # SwiftPM synthesizes these module maps for generated C++ targets.
          relative_directory = File.dirname(module_map.delete_prefix('sources/'))
          header_directory = File.realpath(File.join(source_directory, relative_directory))
          candidates = [File.join(header_directory, "#{spec.module_name}.h"), File.join(header_directory, spec.module_name, "#{spec.module_name}.h")]
          umbrella_header = candidates.find { |header| File.file?(header) }
          umbrella = umbrella_header ? %Q(umbrella header "#{umbrella_header}") : %Q(umbrella "#{header_directory}")
          contents = "framework module #{spec.module_name} {\n  #{umbrella}\n  export *\n}\n"
        end
        File.write(File.join(directory, 'module.modulemap'), contents)
        spec.module_map = 'module.modulemap'
      end

      def simdutf_specs
        source = { :git => 'https://github.com/margelo/simdutf-swift.git', :tag => SIMDUTF_VERSION, :submodules => true }
        common = lambda do |name|
          Pod::Spec.new do |spec|
            spec.name = name
            spec.version = SIMDUTF_VERSION
            spec.summary = 'SIMD Unicode validation and conversion for Swift.'
            spec.homepage = 'https://github.com/margelo/simdutf-swift'
            spec.license = { :type => 'MIT', :file => 'LICENSE' }
            spec.authors = 'Marc Rousavy'
            spec.source = source
            spec.ios.deployment_target = '16.0'
            spec.osx.deployment_target = '13.0'
            spec.tvos.deployment_target = '16.0'
            spec.visionos.deployment_target = '1.0'
            spec.swift_version = '6.0'
          end
        end
        cxx = common.call('CSimdUTF')
        cxx.source_files = 'Sources/CSimdUTF/**/*.{h,cpp}'
        cxx.public_header_files = 'Sources/CSimdUTF/include/*.h'
        cxx.header_mappings_dir = 'Sources/CSimdUTF/include'
        cxx.preserve_paths = 'simdutf/include/**/*', 'simdutf/src/**/*', 'simdutf/LICENSE-MIT', 'simdutf/LICENSE-APACHE', 'NOTICE'
        cxx.pod_target_xcconfig = {
          'DEFINES_MODULE' => 'YES',
          'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
          'HEADER_SEARCH_PATHS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/simdutf/include" "$(PODS_TARGET_SRCROOT)/simdutf/src"',
          'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) SIMDUTF_SWIFT_ENABLE_UTF8=1 SIMDUTF_SWIFT_ENABLE_UTF16=1 SIMDUTF_SWIFT_ENABLE_ASCII=1',
        }
        swift = common.call('SimdUTF')
        swift.source_files = 'Sources/SimdUTF/*.swift'
        swift.dependency('CSimdUTF', SIMDUTF_VERSION)
        swift.pod_target_xcconfig = { 'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => '$(inherited) UTF8 UTF16 ASCII' }
        [cxx, swift]
      end
    end
  end
end

# Call after use_native_modules!, which evaluates each library's podspec.
def use_nitro_modules!
  Nitro::CocoaPods.install(self, frameworks: current_target_definition.uses_frameworks?)
end

# Call after react_native_post_install to keep Swift's C++ headers private.
def nitro_post_install(installer)
  Nitro::CocoaPods.post_install(installer)
end
