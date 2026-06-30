# AIJudge Smart Contract

This directory contains the Solidity implementation of the Privacy-Preserving AI Bounty Judge.

The contract extends the original Ritual Chain workshop by introducing a commit-reveal workflow that prevents participants from copying answers before judging.

---

# Responsibilities

The smart contract is responsible for:

- creating bounties
- managing submission deadlines
- storing commitment hashes
- verifying revealed answers
- collecting valid submissions
- requesting Ritual AI evaluation
- storing AI recommendations
- finalizing one winner
- distributing rewards

The frontend never decides who wins. All critical state transitions are enforced by the contract.

---

# Main Contract

```
contracts/AIJudge.sol
```

---

# Commit-Reveal Design

Instead of storing plaintext answers immediately, participants first submit only a commitment.

```
commitment =
keccak256(
    abi.encodePacked(
        answer,
        salt,
        msg.sender,
        bountyId
    )
)
```

The commitment includes

- answer
- random salt
- sender address
- bounty id

This prevents:

- commitment replay
- copied commitments
- cross-bounty reuse

---

# Lifecycle

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

# Public Functions

## createBounty()

Creates a new bounty.

Stores

- title
- rubric
- deadlines
- reward

---

## submitCommitment()

Stores a participant's commitment hash.

Restrictions

- before commit deadline
- one commitment per wallet

---

## revealAnswer()

Verifies

```
keccak256(answer, salt, sender, bountyId)
```

Only matching commitments become eligible for judging.

---

## judgeAll()

Collects all valid revealed answers.

Creates a single Ritual LLM request.

Stores

- ranking
- scores
- winner recommendation
- summary

---

## finalizeWinner()

Transfers the reward.

Restrictions

- only owner
- only after judging
- only once

---

# Security

Implemented protections include:

- commit deadline enforcement
- reveal deadline enforcement
- one commitment per participant
- commitment verification
- unrevealed submissions ignored
- owner-only judging
- owner-only finalization
- single payout

---

# Tests

```
test/
```

The test suite validates

- bounty creation
- commitment submission
- duplicate commits
- invalid reveals
- deadline enforcement
- reward payout

Run

```bash
pnpm hardhat test
```

---

# Deployment

Compile

```bash
pnpm hardhat compile
```

Deploy

```bash
pnpm hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual
```

Sync frontend ABI

```bash
pnpm sync-abi
```

---

# Design Notes

The contract intentionally keeps AI recommendations advisory.

The bounty owner remains responsible for selecting the final winner, matching the Ritual AI judging model presented during the workshop.