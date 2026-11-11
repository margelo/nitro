import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { LoadContext, Plugin } from '@docusaurus/types';

type ReactPackageName = 'react' | 'react-dom';

interface PackageJson {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  exports?: unknown;
  version?: unknown;
}

interface ResolvedPackage {
  name: ReactPackageName;
  packageJson: PackageJson;
  root: string;
  version: string;
}

interface ReactInstall {
  installRoot: string;
  react: ResolvedPackage;
  reactDom: ResolvedPackage;
}

type ReactInstallResult =
  | {
      ok: true;
      install: ReactInstall;
    }
  | {
      ok: false;
      reason: string;
    };

interface ExpectedReactVersions {
  react: string;
  'react-dom': string;
}

const REACT_PACKAGES = ['react', 'react-dom'] as const satisfies readonly ReactPackageName[];

function readPackageJson(filePath: string): PackageJson {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as PackageJson;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read package.json at ${filePath}: ${reason}`);
  }
}

function dependencyVersion(packageJson: PackageJson, packageName: ReactPackageName): string {
  const version = packageJson.dependencies?.[packageName] ?? packageJson.devDependencies?.[packageName];
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`docs/package.json must declare ${packageName} with an exact version.`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`docs/package.json must pin ${packageName} exactly. Received "${version}".`);
  }
  return version;
}

function installedPackage(installRoot: string, packageName: ReactPackageName): ResolvedPackage | undefined {
  const packageJsonPath = path.join(installRoot, 'node_modules', packageName, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  const packageJson = readPackageJson(packageJsonPath);
  if (typeof packageJson.version !== 'string') {
    throw new Error(`${packageJsonPath} does not contain a valid version.`);
  }

  return {
    name: packageName,
    packageJson,
    root: path.dirname(packageJsonPath),
    version: packageJson.version,
  };
}

function inspectInstallRoot(
  installRoot: string,
  expectedVersions: ExpectedReactVersions
): ReactInstallResult {
  const react = installedPackage(installRoot, 'react');
  const reactDom = installedPackage(installRoot, 'react-dom');

  const missingPackages = [
    react == null ? 'react' : undefined,
    reactDom == null ? 'react-dom' : undefined,
  ].filter((packageName): packageName is ReactPackageName => packageName != null);
  if (missingPackages.length > 0) {
    return {
      ok: false,
      reason: `missing ${missingPackages.join(', ')} under ${path.join(installRoot, 'node_modules')}`,
    };
  }
  if (react == null || reactDom == null) {
    throw new Error(`Unexpected missing React package after validation in ${installRoot}.`);
  }

  if (react.version !== expectedVersions.react) {
    return {
      ok: false,
      reason: `react is ${react.version}, expected ${expectedVersions.react}`,
    };
  }
  if (reactDom.version !== expectedVersions['react-dom']) {
    return {
      ok: false,
      reason: `react-dom is ${reactDom.version}, expected ${expectedVersions['react-dom']}`,
    };
  }

  if (react.version !== reactDom.version) {
    return {
      ok: false,
      reason: `react is ${react.version}, but react-dom is ${reactDom.version}`,
    };
  }

  return {
    ok: true,
    install: {
      installRoot,
      react,
      reactDom,
    },
  };
}

function packageExportSubpaths(packageJson: PackageJson): string[] {
  const exportsField = packageJson.exports;
  if (typeof exportsField === 'string') {
    return [''];
  }
  if (exportsField == null || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    return [''];
  }

  const subpaths = Object.keys(exportsField)
    .filter((key) => key === '.' || (key.startsWith('./') && key !== './package.json'))
    .map((key) => (key === '.' ? '' : key.slice(2)));

  return subpaths.length > 0 ? subpaths : [''];
}

function resolvePackageExport(installRoot: string, resolvedPackage: ResolvedPackage, subpath: string): string {
  const requireFromInstall = createRequire(path.join(installRoot, 'package.json'));
  const request = subpath.length === 0 ? resolvedPackage.name : `${resolvedPackage.name}/${subpath}`;
  const resolvedPath = requireFromInstall.resolve(request);
  const packageRoot = `${resolvedPackage.root}${path.sep}`;

  if (!resolvedPath.startsWith(packageRoot)) {
    throw new Error(`${request} resolved outside ${resolvedPackage.root}: ${resolvedPath}`);
  }

  return resolvedPath;
}

function createReactAliases(install: ReactInstall): Record<string, string> {
  const aliases: Record<string, string> = {
    react: install.react.root,
    'react-dom': install.reactDom.root,
  };

  for (const resolvedPackage of [install.react, install.reactDom]) {
    for (const subpath of packageExportSubpaths(resolvedPackage.packageJson)) {
      const request = subpath.length === 0 ? resolvedPackage.name : `${resolvedPackage.name}/${subpath}`;
      aliases[`${request}$`] = resolvePackageExport(install.installRoot, resolvedPackage, subpath);
    }
  }

  return aliases;
}

function resolveReactInstall(docsRoot: string): ReactInstall {
  const workspaceRoot = path.resolve(docsRoot, '..');
  const docsPackageJson = readPackageJson(path.join(docsRoot, 'package.json'));
  const expectedVersions: ExpectedReactVersions = {
    react: dependencyVersion(docsPackageJson, 'react'),
    'react-dom': dependencyVersion(docsPackageJson, 'react-dom'),
  };

  if (expectedVersions.react !== expectedVersions['react-dom']) {
    throw new Error(
      `docs/package.json must pin react and react-dom to the same version. ` +
        `Received react ${expectedVersions.react} and react-dom ${expectedVersions['react-dom']}.`
    );
  }

  const installRoots = Array.from(new Set([workspaceRoot, docsRoot]));
  const failures: string[] = [];

  for (const installRoot of installRoots) {
    const result = inspectInstallRoot(installRoot, expectedVersions);
    if (result.ok) {
      return result.install;
    }
    failures.push(`${installRoot}: ${result.reason}`);
  }

  throw new Error(
    `Docusaurus must build with one exact React install (${expectedVersions.react}). ` +
      `No valid install root found:\n${failures.map((failure) => `- ${failure}`).join('\n')}`
  );
}

export default function enforceSingleReactInstance(context: LoadContext): Plugin {
  const reactInstall = resolveReactInstall(context.siteDir);
  const alias = createReactAliases(reactInstall);

  return {
    name: 'enforce-single-react-instance',
    configureWebpack() {
      return {
        resolve: {
          alias,
          modules: [path.join(reactInstall.installRoot, 'node_modules'), 'node_modules'],
        },
      };
    },
  };
}
