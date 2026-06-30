# AI Bounty Judge Frontend

This directory contains the Next.js frontend for the Privacy-Preserving AI Bounty Judge.

The frontend interacts with the deployed AIJudge smart contract and RitualWallet to provide the full user experience.

---

# Features

Users can

- connect a wallet
- create bounties
- commit answers
- reveal answers
- judge submissions
- inspect AI rankings
- finalize winners
- monitor transaction status

---

# Technology Stack

Framework

- Next.js 15

Language

- TypeScript

Wallet

- Wagmi
- Viem

AI

- RitualWallet
- Ritual Chain

---

# Application Flow

```
Connect Wallet

↓

Create Bounty

↓

Commit Answer

↓

Reveal Answer

↓

Judge All

↓

Review AI Output

↓

Finalize Winner
```

---

# Component Overview

## CreateBountyForm

Creates a new bounty.

---

## SubmitAnswer

Generates

- random salt
- commitment hash

Stores

- answer
- salt

inside browser localStorage.

Only the commitment hash is sent to the blockchain.

---

## RevealAnswer

Loads the locally stored

- answer
- salt

and reveals them after the submission deadline.

After a successful reveal, the local data is removed automatically.

---

## JudgeAll

Calls

```
judgeAll()
```

through RitualWallet.

The frontend waits for Ritual AI to complete the evaluation.

---

## AI Review

Displays

- ranking
- scores
- reasoning
- winner recommendation

The AI output is rendered exactly as returned by the contract.

---

## FinalizeWinner

Allows the bounty owner to choose the final winner.

Although the AI recommends a submission, the owner always performs the final payout transaction.

---

# Local Storage

The frontend stores

```
bounty-<id>
```

containing

```
{
    answer,
    salt
}
```

This information never leaves the user's browser until Reveal is executed.

If the storage is deleted before revealing, the commitment can no longer be opened.

---

# Hooks

Important custom hooks

```
useBounty()

useNow()

useRecentBounties()

useWriteTx()

useRitualWalletStatus()
```

These isolate blockchain interactions from UI components.

---

# Running

Install

```bash
pnpm install
```

Start development server

```bash
pnpm dev
```

Open

```
http://localhost:3000
```

---

# Environment

Example

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

Create

```
.env.local
```

Do not commit local environment files.

---

# Notes

The frontend intentionally mirrors the smart contract state machine.

Users only see actions that are valid for the current bounty phase:

- Commit
- Reveal
- Judge
- Finalize

This prevents invalid transactions from being initiated through the interface and keeps the workflow consistent with the underlying Solidity implementation.