# Architecture Note: Commit-Reveal vs. Ritual-Native Hidden Submissions

This note compares the **Required Track** (commit-reveal, implemented in
`hardhat/contracts/AIJudge.sol`) with the **Advanced Track** (Ritual-native
encrypted submissions judged inside a TEE, design only — not implemented).

## 1. The problem

In the original workshop contract, `submitAnswer` writes the plaintext answer
to a public Solidity array immediately. Anyone — including other
participants — can read every prior submission for the cost of a free `eth_call`.
A later participant can therefore read the best existing answer and submit a
strictly better copy, which makes a single-winner bounty unfair.

Both tracks below solve this by making sure **no plaintext answer is publicly
readable before judging is complete**. They differ in *where* the plaintext
exists in the meantime and *who/what* can decrypt it.

## 2. Required Track — Commit-Reveal

### How it works

1. During the submission window, a participant submits only
   `commitment = keccak256(answer, salt, msg.sender, bountyId)`.
2. The plaintext `answer` and `salt` stay on the participant's machine. They
   are never transmitted to the chain or to any third party.
3. After the submission deadline, participants reveal `(answer, salt)`. The
   contract recomputes the hash and checks it against the stored commitment.
4. Only successfully revealed answers are appended to the `submissions` array
   that gets judged.
5. `judgeAll` makes **one** batched call to the Ritual LLM inference
   precompile (`0x0802`) over every revealed submission.

### Where the plaintext exists, and who can read it

- Before reveal: only on the participant's own device. Nobody else — not even
  the bounty owner or the chain — has it.
- After reveal: public, on-chain, in plaintext, in `bounty.submissions`. This
  is intentional and unavoidable with this approach: a reveal *is* a
  publication. Everyone can read everyone's answer the moment the reveal
  transaction lands, but by then the submission window is closed, so it can no
  longer be copied into a new submission for that bounty.

### Tradeoffs

- **Pros**: works on any EVM chain, no special hardware or trust assumptions
  beyond the chain itself, simple to audit, gas cost is just one `bytes32`
  write per participant during the hidden phase.
- **Cons**: requires participants to come back for a second transaction
  (reveal); a participant who forgets to reveal loses their submission
  entirely; revealed answers are *eventually* fully public on-chain (fine for
  a closed bounty, but not suitable if answers must stay confidential
  forever); a participant could in theory choose not to reveal after seeing
  others' early reveals within the reveal window race, though this only lets
  them withdraw, never read an unrevealed answer or improve their own.

## 3. Advanced Track — Ritual-Native Hidden Submissions (design)

### How it would work

1. Each participant encrypts their answer for a Ritual TEE executor's public
   key (or another Ritual privacy/key-management flow such as the DKMS
   precompile), and submits only the ciphertext (or a reference/hash to it
   stored off-chain).
2. The contract stores only the ciphertext reference and its hash — never the
   plaintext, at any point in the lifecycle.
3. During `judgeAll`, the contract calls into a Ritual TEE-backed workflow.
   Inside the TEE, the ciphertexts are decrypted, batched into a single
   prompt, and sent to the LLM precompile together. The TEE's attested
   execution environment is the only place plaintext answers ever exist
   outside each participant's own machine.
4. The LLM returns a ranking/winner; the TEE-backed workflow (still inside the
   trusted environment) assembles a "revealed answers bundle" — all
   plaintext answers plus the result — and publishes it (e.g. to IPFS or
   another off-chain store), then writes only `revealedAnswersRef` (a
   storage pointer) and `revealedAnswersHash` (a commitment to the bundle's
   contents) back on-chain.
5. Anyone can later fetch the bundle from `revealedAnswersRef` and verify
   `keccak256(bundle) == revealedAnswersHash` to confirm it wasn't tampered
   with after the fact.

### Where the plaintext exists, and who can read it

- Before judging: only inside each participant's own machine, in encrypted
  form on-chain.
- During judging: briefly inside the Ritual TEE's attested execution
  environment — never on the public chain, never visible to the bounty owner,
  other participants, or node operators.
- After judging: published in the off-chain revealed-answers bundle, with its
  hash committed on-chain so the bundle's integrity is verifiable.

### What's stored on-chain vs. off-chain

| Data | Location |
|---|---|
| Encrypted answer (or reference to it) | On-chain (small) or off-chain storage + on-chain hash |
| Plaintext answers during judging | Inside the TEE only, never on-chain |
| Final judge result + ranking | On-chain event/struct (small JSON) |
| Revealed plaintext answer bundle | Off-chain (IPFS / storage-ref), only its hash on-chain |

This avoids storing large plaintext strings directly in contract storage,
which is the single biggest gas cost driver for an on-chain bounty system.

### How the LLM receives all submissions together

Same batching principle as the required track: the TEE workflow assembles all
decrypted answers into one structured prompt and makes a single LLM call, not
one call per submission — this keeps cost and latency predictable regardless
of submission count and lets the model compare entries directly against each
other and the rubric.

### How the final reveal happens

The TEE-backed workflow, having already decrypted every answer to judge them,
also performs the reveal: it publishes the full plaintext bundle (or an
encrypted-for-the-public-after-deadline version of it) off-chain and writes
`revealedAnswersRef` + `revealedAnswersHash` on-chain in the same flow that
records `judgeAll`'s result. No separate manual reveal transaction is needed
from participants, unlike the commit-reveal track.

### How the contract verifies/commits to the final bundle

The on-chain `revealedAnswersHash` is a `keccak256` (or similar) commitment
over the canonical serialization of the revealed-answers bundle. Anyone who
fetches the bundle from `revealedAnswersRef` can re-hash it and compare
against the on-chain value — the same trust-but-verify pattern as
commit-reveal, just shifted to apply to the *bundle* instead of individual
answers.

## 4. Comparison summary

| | Commit-Reveal (Required) | Ritual-Native TEE (Advanced) |
|---|---|---|
| Plaintext visible before judging? | No (hash only) | No (encrypted only) |
| Plaintext visible to chain/validators ever? | Yes, after reveal | No — only inside the TEE, briefly |
| Extra participant action required | Yes — a second "reveal" transaction | No — one encrypted submission only |
| Works on any EVM chain | Yes | No — needs Ritual TEE execution |
| Trust assumption | Hash binding only (no special hardware) | Ritual TEE attestation |
| Gas footprint of hidden phase | `bytes32` per submission | Encrypted ciphertext or off-chain ref + hash |
| Failure mode if a participant doesn't act | Submission excluded from judging (no reveal) | Submission can still be judged (no reveal step needed) |

Both designs satisfy the homework's core requirement — no participant can
read another's answer before judging — but the Ritual-native design goes
further by never exposing plaintext on the public chain at all, at the cost
of depending on Ritual-specific TEE infrastructure instead of being portable
to any EVM chain.
