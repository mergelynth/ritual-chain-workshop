# Architecture

## Overview

The application consists of three major components:

```
                    +----------------------+
                    |      Frontend        |
                    |  Next.js + Wagmi     |
                    +----------+-----------+
                               |
                               | Contract Calls
                               |
                    +----------v-----------+
                    |     AIJudge.sol      |
                    |   Ritual Chain       |
                    +----------+-----------+
                               |
             judgeAll()        | Ritual LLM Request
                               |
                    +----------v-----------+
                    |     Ritual AI        |
                    | Batch Evaluation     |
                    +----------------------+
```

---

# Components

## Frontend

Location

```
web/
```

Responsibilities

- Connect wallet
- Create bounty
- Commit answer
- Store answer + salt locally
- Reveal answer
- Display AI review
- Finalize winner
- Display transaction status

Main libraries

- Next.js
- React
- Wagmi
- Viem

---

## Smart Contract

Location

```
hardhat/contracts/AIJudge.sol
```

Responsibilities

- Store bounties
- Store commitments
- Verify reveals
- Collect revealed answers
- Request Ritual AI review
- Store AI response
- Transfer reward

The contract never stores plaintext answers during the commit phase.

---

## Ritual AI

Responsibilities

- Receive all revealed answers
- Compare submissions together
- Produce ranking
- Recommend a winner
- Generate reasoning

Only one AI request is executed per bounty.

No per-submission LLM calls are made.

---

# Commit-Reveal Design

```
Participant
     │
     │ answer + salt
     ▼
keccak256()
     │
     ▼
commitment
     │
submitCommitment()
     │
     ▼
Blockchain
```

Only the commitment hash is stored.

Example

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

Including

- sender
- bounty id

prevents commitment reuse by another participant.

---

# Reveal Flow

```
Participant
     │
     │ answer
     │ salt
     ▼
revealAnswer()
     │
     ▼
Contract
     │
     ├── recompute hash
     │
     ├── compare
     │
     └── accept or reject
```

Only matching commitments become eligible for judging.

---

# Judging Flow

```
Reveal deadline
       │
       ▼
judgeAll()
       │
       ▼
Collect revealed answers
       │
       ▼
Single Ritual AI request
       │
       ▼
Receive ranking
       │
       ▼
Store AI review
```

The AI evaluates every submission together.

This avoids inconsistent scoring that could happen with independent evaluations.

---

# Finalization Flow

```
AI Recommendation
        │
        ▼
Owner reviews output
        │
        ▼
finalizeWinner()
        │
        ▼
Reward transfer
```

The AI recommendation is advisory.

The bounty owner always makes the final decision.

---

# On-Chain Data

Stored on-chain

- bounty metadata
- reward
- deadlines
- commitment hashes
- revealed answers
- AI review
- winner
- payout status

---

# Local Browser Storage

Stored locally

```
localStorage
```

Contains

- original answer
- random salt

The frontend removes this data after a successful reveal.

---

# Security Model

## Commit Phase

Visible

- commitment hash

Hidden

- answer
- salt

---

## Reveal Phase

Visible

- answer
- salt

Verified

- commitment hash

---

## Judge Phase

Visible

- all revealed answers

Hidden

- unrevealed submissions

---

# Access Control

Owner

- create bounty
- judge submissions
- finalize winner

Participant

- submit commitment
- reveal own answer

No participant can reveal another participant's answer because the commitment includes the sender address.

---

# State Machine

```
Create

   │

Commit Phase

   │

Reveal Phase

   │

Judged

   │

Finalized
```

Allowed transitions

```
Create
    ↓
Commit

Commit
    ↓
Reveal

Reveal
    ↓
Judge

Judge
    ↓
Finalize
```

Invalid transitions are rejected by the contract.

---

# Advanced Ritual Design

Current implementation

```
Commit
↓

Reveal

↓

Judge
```

Possible TEE implementation

```
Encrypt answer
      │
      ▼
Store ciphertext
      │
      ▼
TEE decrypts privately
      │
      ▼
LLM evaluates
      │
      ▼
Publish ranking
      │
      ▼
Reveal answers
```

Advantages

- submissions remain hidden until judging completes
- no participant can inspect another answer before evaluation
- AI receives plaintext only inside trusted execution

---

# Design Decisions

## Batch judging

Chosen because

- produces consistent rankings
- lower cost
- satisfies assignment requirements

---

## Commit-Reveal

Chosen because

- EVM compatible
- simple
- deterministic
- prevents answer copying

---

## Human Finalization

Chosen because

- AI may produce imperfect rankings
- owner keeps ultimate control over payout
- matches Ritual AI advisory model