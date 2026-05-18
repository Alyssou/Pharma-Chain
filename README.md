# Pharma Chain

On-chain pharmaceutical batch tracking with role-based access control. This repo focuses on **smart contracts, deployment, and automated tests** before any frontend work so the protocol behavior and permissions are fixed and verifiable first.

## What you built (high level)

- **`contracts/PharmaChain.sol`** — A `PharmaChain` contract using OpenZeppelin `AccessControl` with manufacturer / distributor / pharmacist roles, batch storage, strict status progression, and `BatchUpdated` events for an audit trail.
- **`scripts/deploy.ts`** — Deploys `PharmaChain` (e.g. local or Sepolia via `npm run deploy:sepolia`).
- **`test/PharmaRole.test.ts`** — End-to-end supply-chain tests plus negative tests for invalid skips, wrong recipients, and bad status transitions.
- **`hardhat.config.ts`** — Solidity 0.8.28 with optimizer, Sepolia + Etherscan env wiring, gas reporter.
- **`tsconfig.json`** — TypeScript settings compatible with Hardhat + TypeChain (including `rootDir`).

## Roles used (Access Control)

| Role | Constant | Purpose |
|------|-----------|---------|
| **Admin** | `DEFAULT_ADMIN_ROLE` (built-in) | Granted to deployer in the constructor; can grant/revoke other roles. |
| **Manufacturer** | `MANUFACTURER_ROLE` | Creates batches via `manufactureBatch`. |
| **Distributor** | `DISTRIBUTOR_ROLE` | Receives batch when status moves to **InTransit** (from manufacturer). |
| **Pharmacist** | `PHARMACIST_ROLE` | Receives batch when status moves to **Delivered** (from distributor). |
| **Patient** | *(no on-chain role)* | Final owner after **Sold**; no special role required for the recipient address in that step. |

Status enum (numeric values used in tests): **0** Manufactured → **1** InTransit → **2** Delivered → **3** Sold.

`transferBatch` enforces: only the **current owner** can transfer; **status must strictly increase**; each step checks **sender role**, **prior status**, and **recipient role** where applicable (see contract comments in `PharmaChain.sol`).

## Tools and libraries

| Tool / package | Why it’s here |
|----------------|----------------|
| **[Hardhat](https://hardhat.org/)** | Solidity compile, local network, test runner, scripts. |
| **`@nomicfoundation/hardhat-toolbox`** | Bundles testing (Mocha/Chai), Ethers v6, TypeChain, coverage helpers, etc. |
| **`@openzeppelin/contracts`** | Battle-tested `AccessControl` instead of custom auth. |
| **`hardhat-gas-reporter`** | Optional gas / cost insight during tests (`gasReporter` in `hardhat.config.ts`). |
| **`dotenv`** | Loads `.env` for `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, `ETHERSCAN_API_KEY` (never commit real keys). |
| **TypeScript + TypeChain** | Generated types under `typechain-types/` for safer contract calls from tests/scripts. |

**Node.js:** Hardhat officially supports current LTS Node versions. If you use an older Node (e.g. v17), you may see warnings or odd TypeScript behavior; prefer **Node 20 LTS** for this project.

## Configuration notes (fixes you applied along the way)

1. **`HardhatUserConfig` / `solidity.settings`** — Optimizer and compiler settings belong under `solidity: { version, settings }`, not as a stray top-level `settings` key.
2. **`gasReporter.L2`** — The gas reporter only accepts certain L2 presets (e.g. `arbitrum`); `"polygon"` is not in the allowed union for that option.
3. **`tsconfig.json` → `rootDir`** — With TypeScript 5.x and Hardhat’s layout, setting `"rootDir": "."` avoids `TS5011` (“common source directory is `./test`…”) when running `hardhat test`.

After changing the ABI (new functions on the contract), run **`npx hardhat compile`** so **TypeChain** regenerates `typechain-types/` and stays in sync with `PharmaChain.sol`.

## Test workflow

### Commands

```bash
npm install          # once
npm run compile      # or: npx hardhat compile
npm test             # or: npx hardhat test
```

For Sepolia deployment (after filling `.env`):

```bash
npm run deploy:sepolia
```

### How the tests are structured

1. **`beforeEach`** — Fresh contract each test; five signers (admin, manufacturer, distributor, pharmacist, patient); admin grants the three operational roles.
2. **Happy path** — One test walks the full chain: manufacture → InTransit to distributor → Delivered to pharmacist → Sold to patient; asserts final `batches(batchId)` owner and status.
3. **Negative tests** — Skip distributor, wrong recipient role, invalid status progression / regression, illegal jump to Sold.

### Why Chai + Hardhat matchers

- **`expect(...).to.emit`** — Asserts the contract emitted `BatchUpdated` with the expected indexed args (and `anyValue` for timestamps you don’t need to pin exactly).
- **`expect(...).to.be.revertedWith(...)`** — Asserts `require` string reverts match y0
'/our security rules.

Using **automated tests** here catches permission and state-machine bugs **before** a UI exists; the frontend can then trust a stable ABI and documented flows.

## Deploy script

`scripts/deploy.ts` uses `ethers.deployContract("PharmaChain")`, waits for deployment, and logs the address — that address is what you will plug into a frontend (e.g. wagmi/ethers config) later.

## Suggested order: why contracts and tests before the frontend

1. **Single source of truth** — Rules live on-chain; the UI only reflects them.
2. **Cheaper iteration** — Tests run in seconds; changing Solidity after a UI is wired is slower and error-prone.
3. **Clear ABI** — Compile once; export address + ABI to the app when you start the frontend.
04. **Security** — Role and status checks are proven in tests, not only in UI validation (which can be bypassed).

## Original Hardhat boilerplate (optional)

The lines below were from the sample template; this project’s real entry points are `PharmaChain`, `test/PharmaRole.test.ts`, and `scripts/deploy.ts`.

```shell
npx hardhat help-0-```
