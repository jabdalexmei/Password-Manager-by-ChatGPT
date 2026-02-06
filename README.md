# Password Manager

## Reproducible installs (recommended)

This project relies on deterministic dependency installs.

1) Generate `package-lock.json` once and commit it:

```bash
npm install
```

2) For clean/repeatable installs (CI / new machine), use:

```bash
npm run ci:install
```

`npm ci` installs strictly from the lockfile and will fail if the lockfile and `package.json` are out of sync.

## npm EINTEGRITY remediation (Windows)

If you encounter:
`npm error EINTEGRITY ... wanted sha512-... but got sha512-...`

1. Delete the existing `node_modules/` directory.
2. Clean the npm cache:

   ```bash
   npm cache clean --force
   ```

3. Reinstall dependencies (this will re-create `package-lock.json` if missing):

   ```bash
   npm install
   ```

Notes:
- Prefer keeping `package-lock.json` committed for reproducible builds.
- If the lockfile itself is corrupted, remove it *once*, run `npm install`, and commit the regenerated lockfile.
