# Password Manager

## npm integrity remediation steps (Windows)

If you encounter `npm error EINTEGRITY ... wanted sha512-PLACEHOLDER but got sha512-...` when installing dependencies:

1. Delete the existing `node_modules/` directory.
2. Delete `package-lock.json`.
3. Clean the npm cache:

   ```bash
   npm cache clean --force
   ```

4. Reinstall dependencies and required plugins:

   ```bash
   npm install @tauri-apps/plugin-dialog@^2.0.0 @tauri-apps/plugin-opener@^2.0.0
   npm install
   ```
