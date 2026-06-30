# Security Notes

This document covers the threat model for `AIJudge.sol`'s commit-reveal
flow: what it protects against, what it deliberately does not protect
against, and the specific contract mechanics that enforce each guarantee.

## What the contract prevents

### Answer copying before judging

The core problem this homework solves. During the commit phase, only
`keccak256(abi.encodePacked(answer, salt, msg.sender, bountyId))` is stored
on-chain — the plaintext answer never appears in calldata, storage, or
events until the participant explicitly reveals it. A participant reading
the chain during the commit phase learns nothing usable about any other
submission's content.

### Commitment replay / theft

The hash includes both `msg.sender` and `bountyId`. This means:

- A participant cannot take another participant's `(answer, salt)` pair
  (e.g. if it leaked or was guessed) and reveal it as their own — the
  recomputed hash would use the *caller's* address, which won't match the
  original commitment. `revealAnswer` reverts with `"commitment mismatch"`.
- A commitment created for one bounty cannot be replayed against a
  different bounty, since `bountyId` is part of the hash.

### Duplicate submissions

`submitCommitment` reverts with `"already committed"` if the caller already
has a stored commitment for that `bountyId` (enforced via the
`commitmentIndexPlusOne` mapping, checked in O(1)).

### Invalid reveals

A reveal is only accepted if the recomputed hash matches the stored
commitment exactly. Any mismatch — wrong answer text, wrong salt, or both —
reverts with `"commitment mismatch"`. There is no partial-credit or
fuzzy-match path.

### Out-of-window actions

Every phase-transition is timestamp-gated:

- `submitCommitment` only before `submissionDeadline`.
- `revealAnswer` only between `submissionDeadline` and `revealDeadline`.
- `judgeAll` only after `revealDeadline`, and only once.
- `finalizeWinner` only after `judgeAll` has run, and only once.

### Unauthorized judging / finalization

Both `judgeAll` and `finalizeWinner` are restricted to `bounty.owner` via
the `onlyOwner` modifier. No other address — including participants — can
trigger judging or pick a winner.

### Reward payout safety

- `finalizeWinner` follows checks-effects-interactions: `bounty.finalized`
  is set and `bounty.reward` is zeroed out *before* the external `.call`
  that transfers funds, so a reentrant call back into the contract cannot
  drain the reward twice.
- The payout amount is exactly `bounty.reward` as funded at `createBounty`
  time — there is no path for a partial or inflated payout.
- The transfer's success is checked (`require(ok, "payment failed")`); a
  failed transfer reverts the whole finalization instead of silently
  burning the reward.

### Unrevealed submissions never influence the outcome

`judgeAll` only operates on `bounty.submissions`, which is populated
exclusively by successful `revealAnswer` calls. A commitment that is never
revealed is excluded from judging and can never win — its plaintext answer
is also never readable on-chain, by anyone, ever.

## What the contract does *not* protect against (and why that's expected)

### Answers become public after reveal

By design — see `ARCHITECTURE.md`. The required (commit-reveal) track only
guarantees secrecy *during* the submission window, since the unfairness
problem (copying) only exists before the deadline. Once revealed, on-chain
data is public to anyone, including other participants, indexers, and
block explorers. This is the documented limitation that motivates the
Advanced (Ritual-native TEE) track — see `LIMITATIONS.md`.

### Front-running / MEV on reveal transactions

A reveal transaction is visible in the mempool before it's mined. In
principle, a validator/searcher with reordering power could see a reveal
and, if a manipulable on-chain action depended on its exact content within
the same block, act on it first. In practice this doesn't help an attacker
here: by the time anyone can submit a *valid* reveal for a given bounty,
the commit (hidden) phase is already closed, so there is nothing left to
"front-run" into — a copied answer can no longer be committed as a new
submission for that bounty.

### Owner discretion

`finalizeWinner` lets the bounty owner choose *any* revealed submission's
index as the winner — the contract does not force the on-chain winner to
match the AI's recommendation. This is intentional, per the homework's
"human-in-the-loop finalization" requirement (Notes and Constraints,
PDF section 9): AI output is advisory, and a human makes the final,
irreversible payout decision. This is a design choice, not a bug, but it
does mean a malicious or careless owner could ignore the AI ranking
entirely. Mitigating this (e.g. requiring the owner's choice to match the
AI's top pick, or adding a dispute window) was out of scope for the
required track.

### Off-chain LLM input integrity

`judgeAll` accepts `llmInput` as an opaque `bytes calldata` parameter built
off-chain (see `web/src/lib/ritualLlm.ts`). The contract does not verify
that `llmInput` faithfully encodes every revealed submission — it trusts
whatever the bounty owner submits. A dishonest owner could in principle
construct a prompt that omits or alters submissions before sending it to
the LLM precompile. This is acceptable for a workshop-scale required track,
since the owner already has unilateral finalization power anyway, but a
production system would want this enforced on-chain or attested
(e.g. inside a TEE, as discussed in the Advanced Track).

### Denial of service via no-shows

If a participant commits but never reveals, their submission is simply
excluded — it cannot block judging or finalization for everyone else.
`judgeAll` only requires `bounty.submissions.length > 0`, i.e. *at least
one* valid reveal, not that *all* commitments be revealed.

## Bounds and limits

- `MAX_SUBMISSIONS = 10` commitments per bounty — caps gas growth for the
  per-bounty arrays (`commitments[]`, `submissions[]`) and the eventual
  batch-judging prompt size.
- `MAX_ANSWER_LENGTH = 2_000` bytes — caps the gas cost of a single reveal
  and the resulting on-chain string storage.

Both are simple, explicit bounds chosen for a workshop-scale deployment;
they are not configurable per-bounty.
