# AIJudge — Commit-Reveal Bounty Judge (Hardhat 3 + viem)

Privacy-preserving rewrite of the workshop `AIJudge` contract. Answers stay
hidden as a `keccak256` commitment during the submission window and only
become readable on-chain once their author reveals them — so nobody can read
and copy a better answer before the bounty closes.

This package implements the **Required Track** (commit-reveal) from the
homework brief. See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) at the repo
root for the Advanced Track (Ritual-native encrypted submissions) design
comparison, and [`../REFLECTION.md`](../REFLECTION.md) for the reflection
answer.

## Bounty lifecycle

```
createBounty(title, rubric, submissionDeadline, revealDeadline)
        │
        ▼
 submission phase  ── submitCommitment(bountyId, keccak256(answer, salt, sender, bountyId))
        │               (plaintext answer never leaves the participant's machine)
        ▼  submissionDeadline reached
   reveal phase     ── revealAnswer(bountyId, answer, salt)
        │               (contract recomputes the hash and checks it matches)
        ▼  revealDeadline reached
   judgeAll(bountyId, llmInput)        ── one batched Ritual LLM precompile call
        │                                  over every *revealed* answer
        ▼
 finalizeWinner(bountyId, winnerIndex) ── owner pays out the single winner
```

Unrevealed commitments are simply excluded from judging — there is no way to
read their plaintext answer at all, ever, which is intentional (a no-show
participant shouldn't get their answer leaked either).

## Contract rules enforced

- A participant may submit **exactly one** commitment per bounty
  (`commitmentIndexPlusOne` mapping enforces this in O(1)).
- Commitments are only accepted **before** `submissionDeadline`.
- Reveals are only accepted **between** `submissionDeadline` and
  `revealDeadline`.
- A reveal is valid only if
  `keccak256(answer, salt, msg.sender, bountyId) == storedCommitment` —
  including `msg.sender` and `bountyId` in the hash means a copied
  `(answer, salt)` pair cannot be replayed by a different account or against a
  different bounty.
- `judgeAll` can only run after `revealDeadline`, only once, only by the
  bounty owner, and only if at least one answer was revealed. It makes a
  single batched call to the Ritual LLM inference precompile (`0x0802`) — not
  one call per submission.
- `finalizeWinner` can only run after judging, only once, only by the owner,
  and only with a winner index inside the revealed-submissions range. It pays
  the full reward to the single winner and zeroes out the bounty's reward
  balance before sending funds (checks-effects-interactions).

## Project layout

```
contracts/
  AIJudge.sol                Required-track commit-reveal contract
  utils/PrecompileConsumer.sol  Ritual precompile call helper (unchanged)
  mocks/MockLLMPrecompile.sol   Test-only stand-in for the 0x0802 precompile
test/
  AIJudge.ts                  Full TypeScript integration test suite
ignition/modules/AIJudge.ts   Deployment module (no constructor args)
scripts/sync-abi.ts           Syncs the compiled ABI into web/src/abi/*.ts
```

## Running it

```bash
# install deps
pnpm install

# compile
npx hardhat compile

# run the full test suite (commit-reveal correctness, access control, payouts)
npx hardhat test

# regenerate web/src/abi/AIJudge.ts from the freshly compiled artifact
pnpm run sync-abi

# deploy
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network hardhatMainnet
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network sepolia
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual
```

See the repo-root `SETUP.md` for the complete local setup, `.env` creation,
testing, deployment, and GitHub publishing walkthrough.

## Testing the Ritual LLM precompile locally

Local Hardhat networks don't run the real Ritual node, so there is no code at
the `0x0802` LLM inference precompile address by default. The test suite
deploys `MockLLMPrecompile` and uses viem's `testClient.setCode` to install
its bytecode at `0x0802` before exercising `judgeAll`, so the full
encode → precompile call → decode path is covered end-to-end without needing
a real Ritual devnet.
