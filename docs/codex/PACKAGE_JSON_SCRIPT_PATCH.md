# package.json Codex Scripts

Installed scripts:

```json
{
  "scripts": {
    "check": "npm run lint && npm run build",
    "codex:health": "npm run check",
    "codex:build": "npm run build"
  }
}
```

## Windows Note

From PowerShell on this machine, use:

```powershell
npm.cmd run codex:health
npm.cmd run codex:build
```

Bare `npm` may hit the local PowerShell execution-policy block for `npm.ps1`.

## Lint Note

ESLint must ignore generated folders such as `.next-build/`, `.next-local/`, and `tmp_*/`.
