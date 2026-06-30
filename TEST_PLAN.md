# Test Plan

## Overview

This document describes the testing strategy for the Privacy-Preserving AI Bounty Judge.

The focus is validating the commit-reveal workflow, access control, deadline enforcement, AI judging, and reward distribution.

---

# Test Environment

## Smart Contract

- Solidity
- Hardhat
- Viem
- Ritual Chain

## Frontend

- Next.js
- React
- Wagmi
- MetaMask
- Ritual Wallet

---

# Functional Tests

## 1. Create Bounty

### Goal

Verify that a bounty can be created successfully.

### Steps

1. Connect owner wallet.
2. Enter title.
3. Enter rubric.
4. Set submission deadline.
5. Set reveal deadline.
6. Set reward.
7. Create bounty.

### Expected Result

- Bounty is created.
- Reward is locked.
- Status is **Commit Phase**.

---

## 2. Commit Answer

### Goal

Verify that participants submit only a commitment.

### Steps

1. Connect participant wallet.
2. Enter answer.
3. Submit commitment.

### Expected Result

- Transaction succeeds.
- Commitment hash is stored.
- Plaintext answer is NOT stored on-chain.
- Answer and salt are stored locally.

---

## 3. Duplicate Commitment

### Goal

Ensure only one commitment is allowed.

### Steps

1. Submit one commitment.
2. Attempt to submit another.

### Expected Result

Transaction reverts.

---

## 4. Commit After Deadline

### Goal

Ensure submission deadline is enforced.

### Steps

1. Wait until commit deadline.
2. Attempt to submit.

### Expected Result

Transaction reverts.

---

## 5. Reveal Answer

### Goal

Verify successful reveal.

### Steps

1. Wait for reveal phase.
2. Reveal original answer.
3. Reveal original salt.

### Expected Result

- Transaction succeeds.
- Commitment verification passes.
- Answer becomes eligible for judging.

---

## 6. Invalid Reveal

### Goal

Verify commitment verification.

### Steps

Reveal using:

- modified answer
- modified salt

### Expected Result

Transaction reverts with commitment mismatch.

---

## 7. Reveal Before Commit Deadline

### Goal

Ensure reveal cannot happen early.

### Steps

Attempt reveal before commit phase ends.

### Expected Result

Transaction reverts.

---

## 8. Reveal After Reveal Deadline

### Goal

Ensure reveal window closes correctly.

### Steps

Attempt reveal after reveal deadline.

### Expected Result

Transaction reverts.

---

## 9. Judge Before Reveal Deadline

### Goal

Ensure judging starts only after reveals finish.

### Steps

Owner calls

```
judgeAll()
```

before reveal deadline.

### Expected Result

Transaction reverts.

---

## 10. Judge After Reveal Deadline

### Goal

Verify AI batch judging.

### Steps

1. Wait for reveal deadline.
2. Execute

```
judgeAll()
```

### Expected Result

- Ritual AI request is executed.
- AI review is stored.
- Ranking is displayed.

---

## 11. Finalize Winner

### Goal

Verify reward payout.

### Steps

1. Wait for AI review.
2. Finalize winner.

### Expected Result

- Winner stored.
- Reward transferred.
- Bounty finalized.

---

## 12. Double Finalization

### Goal

Prevent duplicate payouts.

### Steps

Attempt finalization twice.

### Expected Result

Transaction reverts.

---

# Security Tests

## Commitment Replay

### Test

Reuse another participant's commitment.

### Expected

Reveal fails because

```
msg.sender
```

is part of the commitment.

---

## Wrong Bounty Replay

### Test

Reuse commitment in another bounty.

### Expected

Reveal fails because

```
bountyId
```

is included in the hash.

---

## Unrevealed Submission

### Test

Commit without revealing.

### Expected

Submission is ignored during AI judging.

---

## Unauthorized Judge

### Test

Non-owner calls

```
judgeAll()
```

### Expected

Transaction reverts.

---

## Unauthorized Finalize

### Test

Non-owner finalizes winner.

### Expected

Transaction reverts.

---

# Frontend Tests

## Wallet Connection

Verify

- MetaMask connection
- Ritual Wallet connection

---

## Commit UI

Verify

- button disabled without wallet
- button disabled with empty answer
- transaction status updates

---

## Reveal UI

Verify

- reveal only during reveal phase
- local answer loads correctly
- local data removed after successful reveal

---

## AI Review

Verify

- ranking displayed
- scores displayed
- summary displayed
- recommended winner highlighted

---

## Finalization UI

Verify

- only owner can finalize
- recommendation displayed
- finalized state shown

---

# Manual End-to-End Test

Execute the complete workflow.

1. Create bounty.
2. Submit commitment.
3. Wait for reveal phase.
4. Reveal answer.
5. Wait for reveal deadline.
6. Execute AI judging.
7. Review AI ranking.
8. Finalize winner.
9. Verify reward transfer.

Expected Result

The entire lifecycle completes without errors.

---

# Edge Cases

| Test | Expected |
|-------|----------|
| Empty answer | Rejected |
| Duplicate commitment | Rejected |
| Wrong salt | Rejected |
| Wrong answer | Rejected |
| Reveal too early | Rejected |
| Reveal too late | Rejected |
| Judge too early | Rejected |
| Judge twice | Rejected |
| Finalize twice | Rejected |
| Unrevealed submission | Ignored |

---

# Success Criteria

The implementation is considered correct if:

- All deadlines are enforced.
- Commitments cannot be forged.
- Invalid reveals fail.
- Unrevealed answers are excluded.
- AI judges all revealed submissions together.
- Only the owner can judge and finalize.
- Only one reward is paid.
- The frontend correctly reflects every lifecycle state.