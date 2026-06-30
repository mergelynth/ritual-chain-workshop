# Test Plan — AIJudge Commit-Reveal

Full automated coverage lives in `hardhat/test/AIJudge.ts` (run with
`npx hardhat test`). This document summarizes the cases covered and why each
matters, as required by the homework deliverables.

## Bounty creation

| Case | Expected result | Why it matters |
|---|---|---|
| Valid title/rubric/deadlines + reward > 0 | Bounty created, `BountyCreated` emitted with correct args | Baseline happy path |
| `msg.value == 0` | Reverts `"reward required"` | No bounty should exist without funds to pay a winner |
| `revealDeadline <= submissionDeadline` | Reverts `"reveal deadline before submission deadline"` | Prevents a malformed bounty where reveal never has a valid window |

## Commitment phase (`submitCommitment`)

| Case | Expected result | Why it matters |
|---|---|---|
| Commit before `submissionDeadline` | Accepted, `AnswerCommitted` emitted, commitment hash stored | Core hidden-submission path |
| Read bounty/commitment state right after committing | No plaintext answer retrievable anywhere (`getSubmission` reverts, `revealedCount == 0`) | Proves answers are genuinely hidden, not just unlabeled |
| Same participant commits twice | Reverts `"already committed"` | One submission per participant per bounty |
| Commit after `submissionDeadline` | Reverts `"submission phase closed"` | Enforces the hidden-submission window boundary |

## Reveal phase (`revealAnswer`)

| Case | Expected result | Why it matters |
|---|---|---|
| Reveal before `submissionDeadline` | Reverts `"reveal phase not started"` | Reveals can't leak answers early |
| Reveal with correct `(answer, salt)` during the window | Accepted, `AnswerRevealed` emitted, answer becomes readable via `getSubmission` | Core reveal correctness |
| Reveal with wrong answer or wrong salt | Reverts `"commitment mismatch"` | Hash check must actually validate input |
| Reveal with no prior commitment (e.g. uninvolved account) | Reverts `"no commitment found"` | Can't reveal something you never committed |
| Reveal someone else's known `(answer, salt)` pair from a different account | Reverts `"commitment mismatch"` | Confirms `msg.sender` is bound into the hash, so a copied commitment can't be claimed by another participant |
| Reveal the same commitment twice | Reverts `"already revealed"` | Prevents duplicate submission entries |
| Reveal after `revealDeadline` | Reverts `"reveal phase closed"` | Enforces the reveal window boundary |
| One participant reveals, another doesn't | Only the revealed answer appears in `submissions`; `commitmentCount` still reflects both | Confirms a no-show's answer is never exposed and never judged |

## Judging (`judgeAll`)

| Case | Expected result | Why it matters |
|---|---|---|
| Judge before `revealDeadline` | Reverts `"reveal phase not finished"` | Judging can't start while reveals are still possible |
| Judge as a non-owner | Reverts `"not bounty owner"` | Only the bounty owner can trigger judging / spend the LLM call |
| Judge with zero revealed submissions | Reverts `"no revealed submissions"` | Nothing to judge if everyone ghosted the reveal phase |
| Judge with >=1 revealed submission, after `revealDeadline` | `AllAnswersJudged` emitted, `bounty.judged == true`, `aiReview` populated from a single batched precompile call | Core judging correctness; verifies the single-call batching contract requirement |
| Judge twice | Reverts `"already judged"` | Judging is a one-time, irreversible action |

The Ritual LLM inference precompile (`0x0802`) is mocked locally via
`MockLLMPrecompile` + `testClient.setCode`, so these tests exercise the real
`abi.decode` path against a deterministic response without needing a live
Ritual devnet (see `hardhat/README.md` for details).

## Finalization (`finalizeWinner`)

| Case | Expected result | Why it matters |
|---|---|---|
| Finalize before judging | Reverts `"not judged yet"` | Can't pay out before the AI has ranked submissions |
| Finalize as non-owner | Reverts `"not bounty owner"` | Only the owner can trigger payout |
| Finalize with an out-of-range winner index | Reverts `"invalid winner index"` | Prevents indexing into a non-existent submission / undefined winner address |
| Finalize with a valid index | `WinnerFinalized` emitted, winner's balance increases by exactly the reward, contract balance decreases by the same amount, `bounty.finalized == true`, `bounty.reward == 0` | Core payout correctness; uses `viem.assertions.balancesHaveChanged` to verify the exact transfer amount |
| Finalize twice | Reverts `"already finalized"` | Reward can only be paid once |

## Helper

| Case | Expected result | Why it matters |
|---|---|---|
| `computeCommitment(...)` view helper | Matches the off-chain `keccak256(abi.encodePacked(...))` computation used by the test harness | Confirms the on-chain hash formula matches what off-chain tooling (the frontend, in particular) must reproduce when building/verifying commitments |

## Out of scope for this test plan (manual / Advanced Track only)

- Ritual TEE attestation behavior — no TEE runs locally; the Advanced Track
  is a design document (see `ARCHITECTURE.md`), not an implementation.
- Real Ritual LLM precompile response shapes/edge cases beyond the documented
  `(bool hasError, bytes completionData, bytes, string errorMessage,
  ConvoHistory)` tuple — these should be re-verified against a live Ritual
  devnet before mainnet deployment.
