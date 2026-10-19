# Nitro documentation

The [Nitro documentation](https://nitro.margelo.com) uses [Docusaurus](https://docusaurus.io/). Its source lives in the `docs/` directory of `margelo/nitro`.

## Development

From the Nitro repository root:

```sh
bun install --frozen-lockfile --ignore-scripts
bun docs start
```

The docs do not need the native packages or Nitrogen to be built. Docusaurus reloads the site when files change.

## Validation

```sh
bun docs typecheck
bun docs build
```

The build writes the site to `docs/build/`. Preview it with `bun docs serve`.

## Deployment

Configure the Vercel project to use `margelo/nitro`, `main` as its production branch, and `docs` as its root directory, with access to the repository's root `bun.lock`. `vercel.json` installs the locked dependencies without running workspace build scripts, then runs `bun run build` from `docs/`.
