# Setup

This document explains how to build, deploy and run the project locally.

---

# Requirements

Install:

- Node.js 20+
- pnpm
- Git

Recommended:

- VS Code
- MetaMask
- Ritual Wallet extension

---

# Repository Structure

```
.
├── hardhat
└── web
```

---

# Clone

```bash
git clone <repository>
cd ritual-chain-workshop
```

---

# Smart Contract

Move into the Hardhat project.

```bash
cd hardhat
```

Install dependencies.

```bash
pnpm install
```

Compile contracts.

```bash
pnpm hardhat compile
```

Run tests.

```bash
pnpm hardhat test
```

---

# Deploy

Deploy to Ritual Chain.

```bash
pnpm hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual
```

After deployment, copy the deployed contract address.

---

# Sync ABI

Generate the frontend ABI.

```bash
pnpm sync-abi
```

This updates

```
web/src/abi/AIJudge.ts
```

---

# Frontend

Move into the frontend.

```bash
cd ../web
```

Install dependencies.

```bash
pnpm install
```

Start development server.

```bash
pnpm dev
```

Open

```
http://localhost:3000
```

---

# Wallet Configuration

Connect:

- MetaMask
- Ritual Wallet

Switch to

```
Ritual Chain
```

---

# Environment Variables

Create

```
web/.env.local
```

Example

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID
```

Do not commit

```
.env.local
```

---

# Typical Development Workflow

## 1

Modify Solidity contract.

```
hardhat/contracts/AIJudge.sol
```

---

## 2

Compile.

```bash
pnpm hardhat compile
```

---

## 3

Deploy.

```bash
pnpm hardhat ignition deploy
```

---

## 4

Sync ABI.

```bash
pnpm sync-abi
```

---

## 5

Run frontend.

```bash
pnpm dev
```

---

## 6

Test complete flow.

- Create bounty
- Commit answer
- Reveal answer
- Judge submissions
- Finalize winner

---

# Commit-Reveal Testing

Expected lifecycle

```
Create bounty

↓

Commit answer

↓

Submission deadline

↓

Reveal answer

↓

Reveal deadline

↓

Judge all

↓

Finalize winner
```

---

# Local Storage

The frontend stores

- answer
- random salt

inside

```
localStorage
```

using

```
bounty-<id>
```

The data is automatically removed after a successful reveal.

---

# Common Issues

## Commitment mismatch

Possible causes

- localStorage was cleared
- wrong wallet
- different answer
- different salt

---

## Reveal unavailable

Verify

- submission deadline passed
- reveal deadline not passed

---

## Judge button disabled

Verify

- reveal deadline finished
- RitualWallet connected
- sufficient RITUAL balance

---

## Finalize unavailable

Verify

- AI review completed
- owner wallet connected

---

# Useful Commands

Compile

```bash
pnpm hardhat compile
```

Test

```bash
pnpm hardhat test
```

Deploy

```bash
pnpm hardhat ignition deploy
```

Sync ABI

```bash
pnpm sync-abi
```

Run frontend

```bash
pnpm dev
```

Lint

```bash
pnpm lint
```

---

# Verification Checklist

Before submission verify:

- Contract compiles
- Tests pass
- ABI synchronized
- Frontend loads
- Wallet connects
- Commit works
- Reveal works
- AI judging works
- Winner finalization works