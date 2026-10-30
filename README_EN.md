**中文** · [README.md](./README.md)

> [!WARNING]
> **⚠️ This axis has been merged into the [doctors](https://github.com/huanweide/doctors) family monorepo and is no longer maintained here.**
>
> The source now lives at [`doctors/packages/secscan/`](https://github.com/huanweide/doctors/tree/main/packages/secscan). Inside doctors it runs as the `doctors sec` subcommand (or `node packages/secscan/index.js`). This repository no longer accepts changes — please use <https://github.com/huanweide/doctors>.

<!-- badges -->
[![License](https://img.shields.io/github/license/huanweide/secscan)](LICENSE)
[![Stars](https://img.shields.io/github/stars/huanweide/secscan)](https://github.com/huanweide/secscan/stargazers)
[![Engineering Health Family](https://img.shields.io/badge/Engineering%20Health%20Family-18%20axes-22c55e)](https://github.com/huanweide/family-showcase)
<!-- /badges -->

**🔧 Part of the [Engineering Health Family](https://github.com/huanweide/family-showcase)** (18 zero-dependency checkup axes). Standalone tool — see [doctors](https://github.com/huanweide/doctors) (monorepo) and [enghealth](https://github.com/huanweide/enghealth) (unified runner).

> English: not yet provided

# secscan

Zero-dependency, single-file, out-of-the-box **JS/TS security anti-pattern static scanner CLI**.

Complementary to `devdoctor` (which only scans plaintext secrets): `devdoctor` catches "leaked passwords", `secscan` catches "unsafe API usage".

## Who should use this

- JS/TS projects that want a quick, dependency-free security gate in CI.
- Teams that want to catch `eval`/command-injection/disabled-cert-verification without standing up Semgrep or Snyk.
- Anyone who wants deterministic, reproducible security scanning.

## Who should not use this

- If you need deep taint analysis / SAST with cross-file data flow — use Semgrep/Snyk Code.
- Note: this repo is deprecated — prefer `doctors sec` for new setups.

## Why you need it

- `eval()` / `new Function()` opens a code-execution backdoor for attackers;
- `child_process.exec('command ' + userInput)` is classic command injection;
- `rejectUnauthorized: false` switches off HTTPS man-in-the-middle protection in one line;
- plaintext `http://` transport, SQL string concatenation, `Math.random()` in security contexts… are all frequent footguns.

Semgrep needs Python + rule YAML; eslint-plugin-security needs ESLint configured; snyk code needs an account. **secscan needs nothing installed, nothing configured** — a `node index.js` or a globally-installed `secscan` scans immediately.

## Install and run

```bash
# Run the single file directly (no install needed)
node index.js <directory>

# Or install this project globally from GitHub (see the npm warning below)
npm install -g github:huanweide/secscan
```

> Zero runtime dependencies, only Node built-in `fs` / `path`. Supports Node 18+.
>
> **Do not use `npx secscan` or `npm i -g secscan`.** The `secscan` name on npm belongs to Mozilla's scanjs (a different project). This project is not published under that name — run `node index.js` directly, or install from GitHub as shown above.

## Usage

```bash
# Scan the current directory
secscan

# Scan a specific directory
secscan ./src

# JSON only (feed CI / other tools)
secscan ./src --json

# CI gate: fail on any high-severity anti-pattern (exit 2)
secscan ./src --fail-on-high

# Finer gate: per-category count caps
secscan ./src --max-high 0 --max-medium 5 --max-issues 10
```

### Options

| Option | Description |
|------|------|
| `[root]` / `--root <dir>` | scan root (default current directory) |
| `--ext <csv>` | scan only these extensions, e.g. `js,ts,tsx` |
| `--json` | output JSON |
| `--fail-on-high` | fail on any high-severity anti-pattern (exit 2) |
| `--max-high <n>` | high cap, fail if exceeded |
| `--max-medium <n>` | medium cap |
| `--max-low <n>` | low cap |
| `--max-issues <n>` | total issue cap |
| `-V, --version` | version |
| `-h, --help` | help |

## Supported scan targets

`.js` `.mjs` `.cjs` `.ts` `.jsx` `.tsx` `.vue` `.svelte`

Auto-skips `node_modules` `.git` `dist` `build` `coverage` etc.; single files over 5MB are skipped (OOM guard).

## Rule set

| ID | Severity | Detects |
|----|--------|----------|
| S1 | high | `eval()` / `new Function()` dynamic code execution (RCE risk) |
| S2 | high | `child_process` command content uncontrollable: string concatenation / template interpolation / variable argument (command injection) |
| S3 | high | TLS cert verification disabled (`rejectUnauthorized:false` / `NODE_TLS_REJECT_UNAUTHORIZED=0`) |
| S4 | medium | plaintext `http://` transport (recommend HTTPS) |
| S5 | medium | SQL statement string concatenation (SQL injection) |
| S6 | medium | `Math.random()` in a security context (token/secret/id/nonce etc.) |
| S7 | low | `child_process` safe form: pure static constant command, or `execFile(cmd,[...])` array args (no shell, no injection surface) |

## Health score

Weighted deduction: `high=3 / medium=2 / low=1`. Every 1000 lines of code gets 1 "free" point; beyond that each point deducts 12, minimum 0.

```
secscan v1.0.0 · security anti-pattern scan
scanned 2 files / 1049 lines
  S2  high    test.js:181   child_process command concat (command injection)
  S2  high    test.js:198   child_process command concat (command injection)
health score: 41/100
  high=2 medium=0 low=0
```

## Zero-false-positive discipline (dogfood to zero)

- Its own `index.js` scan result must be **0 issues** (this is asserted in unit tests, guarding against regressions).
- A character-by-character tokenizer first blanks comments / strings to spaces (newlines preserved), detecting dangerous patterns only on "bare code"; the string region is separately checked for plaintext `http://`.
- Regex literals (e.g. `/^\s*['"`]/`) are correctly recognized and their inner bare quotes don't interfere.
- All rule regexes are built with `new RegExp(string)`, and the pattern itself sits inside quotes that get stripped — **the tool never reports its own examples as vulnerabilities**.
- `exec` family is only flagged in files that actually `import/require child_process`, avoiding misreporting a regex object's `.exec()` method as command injection.

## Examples

```js
// Dangerous form (caught by S1 / S2 / S3 / S4)
eval(userInput);
const { exec } = require('child_process');
exec('ls ' + userInput);          // S2 command injection
https.get('http://api.x.com');    // S4 plaintext transport
```

```js
// Safe form
const { execFile } = require('child_process');
execFile('ls', [userInput]);      // array args, no concatenation
const crypto = require('crypto');
crypto.randomUUID();              // safe random, not Math.random
```

## In CI

```yaml
# .github/workflows/security.yml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '20'
- name: secscan
  run: node index.js ./src --fail-on-high --max-medium 0
```

> **Do not use `npx secscan`.** The `secscan` on npm is Mozilla's scanjs (a different project), unrelated to this tool. Use `node index.js` directly — this project is zero-dependency and needs no install.

## License

MIT

---

## Author

Maintained by **huanweide** · [GitHub](https://github.com/huanweide)

## S2 / S7 judge severity by "argument shape", not "is the first char a quote"

This is the easiest place for secscan to judge backwards, and the common source of both false positives and false negatives. The rule:

| Writing | Judgment | Reason |
| --- | --- | --- |
| `exec('ls ' + x)` | **S2 high** | string concatenation, command content affected by input |
| `execSync(`rm -rf ${p}`)` | **S2 high** | template interpolation, the most dangerous injection form |
| `exec(userCmd)` | **S2 high** | command content completely uncontrollable |
| `execFile(cmd, [a, b])` | S7 low | no shell, array args, no injection surface |
| `exec('ls')` | S7 low | pure static constant |

At the same time, **a regex object's `.exec()` is not misjudged** (`re.exec(content)` vs `cp.exec(x)` are distinguished by the identifier before the dot).

> The old implementation only looked at "is the first char a quote", but its input was code text with strings already erased — so it judged all the high/low in the table above **backwards**, and template interpolation was missed entirely. Fixed.

## Test

```bash
node --test test.js        # 13 unit tests (incl. extension-pollution regression + dogfood-to-zero)
node scripts/smoke-cli.js  # end-to-end assertions
```

CI (`.github/workflows/verify.yml`) runs unit tests and smoke on ubuntu + windows.

## License

See [LICENSE](LICENSE).

---

## Portability · zero-dependency promise

- Zero runtime dependencies: uses only one Node built-in module, no `npm install`.
- Single file: the whole tool is one `index.js`, copy it into any repo and it works.
- Offline / cross-platform: Node 18+ is enough, no network, no OS preference.
- One command: `node index.js --root ./src` (see Usage above).

← [Back to the code-health family overview](https://github.com/huanweide/family-showcase)
