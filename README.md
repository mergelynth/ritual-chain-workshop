# Privacy-Preserving AI Bounty Judge

A decentralized bounty platform built on Ritual Chain where submissions remain hidden during the submission phase and are evaluated together by an AI model after the reveal phase.

This project extends the original workshop implementation by introducing a commit-reveal workflow that prevents participants from copying answers before judging.

---

# Features

## Smart Contract

- Create AI bounty
- Commit-reveal submission flow
- One commitment per participant
- Commitment verification
- AI batch judging
- Owner-controlled winner finalization
- Reward payout
- Submission and reveal deadlines

## Frontend

- Wallet connection
- Create bounty
- Commit answer
- Reveal answer
- Judge all submissions
- View AI ranking
- Finalize winner
- Transaction status
- RitualWallet integration

---

# Problem

The original workshop stored every submission on-chain immediately.

This allowed participants to:

- read previous submissions
- copy ideas
- submit improved answers
- gain an unfair advantage

The new implementation hides answers until the reveal phase.

---

# Commit-Reveal Workflow

```text
Create bounty
      │
      ▼
Commit phase
submitCommitment()
      │
      ▼
Reveal phase
revealAnswer()
      │
      ▼
Reveal deadline
      │
      ▼
judgeAll()
      │
      ▼
AI ranking
      │
      ▼
finalizeWinner()
      │
      ▼
Reward paid
```

---

# Lifecycle

## 1. Create bounty

The owner creates a bounty containing:

- title
- rubric
- submission deadline
- reveal deadline
- reward

---

## 2. Commit phase

Participants submit only a commitment.

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

Only the hash is stored on-chain.

The answer stays private.

---

## 3. Reveal phase

After the submission deadline participants reveal

- answer
- salt

The contract recomputes the commitment.

Only matching commitments are accepted.

---

## 4. AI judging

After the reveal deadline the owner calls

```
judgeAll()
```

All revealed answers are sent to Ritual AI in a single request.

The model returns

- ranking
- scores
- winner recommendation
- summary

---

## 5. Finalization

The owner reviews the AI output.

The owner selects one winner.

The contract transfers the reward.

---

# Contract Rules

Implemented protections:

- one commitment per wallet
- commit deadline enforced
- reveal window enforced
- commitment verification
- unrevealed submissions ignored
- judging only after reveal deadline
- finalization only after judging
- single reward payout

---

# Repository Structure

```
.
├── hardhat/
│   ├── contracts/
│   ├── scripts/
│   ├── test/
│   └── README.md
│
├── web/
│   ├── src/
│   └── README.md
│
├── ARCHITECTURE.md
├── SETUP.md
├── TEST_PLAN.md
├── SECURITY.md
├── LIMITATIONS.md
├── REFLECTION.md
└── README.md
```

---

# Technologies

Frontend

- Next.js
- React
- TypeScript
- Wagmi
- Viem

Smart Contract

- Solidity
- Hardhat

AI

- Ritual Chain
- RitualWallet
- Ritual LLM

---

# Running

Install

```
pnpm install
```

Compile

```
cd hardhat
pnpm hardhat compile
```

Run frontend

```
cd web
pnpm dev
```

---

# Security

The implementation prevents:

- answer copying
- commitment replay
- commitment theft
- multiple submissions
- invalid reveals

See:

```
SECURITY.md
```

---

# Testing

The project includes:

- contract tests
- manual UI validation
- commit-reveal verification
- AI judging validation

See:

```
TEST_PLAN.md
```

---

# Current Limitations

Current implementation still reveals answers before AI judging.

The Advanced Ritual design would instead:

- encrypt submissions
- store ciphertext
- execute judging inside a TEE
- reveal answers only after judging completes

See:

```
LIMITATIONS.md
```

---

# Homework Deliverables

- ✅ Commit-reveal workflow
- ✅ Updated Solidity contract
- ✅ Updated frontend
- ✅ Batch AI judging
- ✅ Winner finalization
- ✅ Test plan
- ✅ Architecture documentation
- ✅ Reflection
- ✅ Security notes

---

# License

Educational project based on the Ritual Chain Workshop.