# Current Limitations

This document lists known limitations of the implemented (Required Track)
commit-reveal system, and how the Advanced Track design in
`ARCHITECTURE.md` would address each one. Nothing here is a bug — these are
explicit scope boundaries of a commit-reveal design on a public EVM chain,
called out per the homework's request for honesty about what is/isn't
solved (PDF section 4, section 9 "Notes and Constraints").

## 1. Answers become public after the reveal deadline

**Limitation:** once a participant calls `revealAnswer`, their plaintext
answer is written to `bounty.submissions` and is readable by anyone —
forever, on every full node and indexer that has ever synced that block.

**Why this is acceptable for the required track:** the homework's fairness
problem is "can a later participant copy an earlier participant's answer
*before the deadline*". Commit-reveal solves exactly that: nobody can
construct a new commitment using a copied answer once the submission window
has closed, regardless of what becomes public afterward.

**Advanced Track fix:** keep answers encrypted (for a Ritual TEE executor)
through judging, and only publish a hash-committed bundle after
`judgeAll` completes — see `ARCHITECTURE.md` section 3.

## 2. The bounty owner sees revealed answers as soon as everyone else does

**Limitation:** there's no privileged early access for the owner — they
read `getSubmission` the same way any other address can, only after reveal.
This is actually a *feature* for the required track (no special trust
needed), but it does mean the owner cannot, for example, pre-screen
submissions before judging.

**Advanced Track fix:** N/A — this isn't something the Advanced Track
changes either; the TEE-backed judging flow is designed to keep answers
hidden from *everyone*, including the owner, until judging completes.

## 3. `judgeAll`'s input is trusted, not verified on-chain

**Limitation:** the contract does not check that `llmInput` actually
contains every revealed submission, unmodified. See `SECURITY.md` for the
full discussion — this is a trust-the-owner assumption.

**Advanced Track fix:** a TEE-backed batch-judging worker would assemble
the prompt from on-chain-committed (and authenticated) data inside an
attested execution environment, removing the need to trust the bounty
owner's off-chain prompt construction.

## 4. No dispute or appeal mechanism

**Limitation:** once `finalizeWinner` is called, the payout is final and
irreversible. There is no on-chain way for a participant to contest the AI
ranking or the owner's choice of winner.

**Advanced Track fix:** out of scope for both tracks as currently designed;
would require a separate escrow/dispute-window mechanism layered on top.

## 5. Fixed caps on submissions and answer length

**Limitation:** `MAX_SUBMISSIONS = 10` and `MAX_ANSWER_LENGTH = 2_000`
bytes are hardcoded constants, not configurable per bounty. A bounty owner
who wants a larger competition or longer-form answers cannot raise these
limits without a contract change.

**Why:** these bounds keep gas costs for `commitments[]`/`submissions[]`
iteration and the eventual batch-judging prompt predictable for a
workshop-scale deployment. Making them per-bounty parameters (with sane
upper bounds) would be a straightforward follow-up, not a redesign.

## 6. No encryption — commit-reveal hides content, not metadata

**Limitation:** even during the hidden phase, on-chain metadata is fully
public: who has committed, how many participants there are, exactly when
each commitment/reveal transaction landed, and (after reveal) which
specific address authored which specific answer. Commit-reveal only hides
the answer *content* before the deadline, not participation patterns.

**Advanced Track fix:** encrypting submissions for a TEE executor (Advanced
Track) would still leave commitment timing and submitter addresses public
on a generic EVM chain — full metadata privacy is a separate, harder
problem not addressed by either track as scoped in this homework.

## 7. Frontend coverage

The `/web` app implements create → commit → reveal → judge → finalize, but
hasn't been exhaustively hardened against every edge case the contract
itself enforces (e.g. UI-side validation mirrors but does not replace the
contract's `require` checks — the contract remains the source of truth for
correctness either way). The frontend is not part of the graded deliverable
per the homework PDF, which is contract-and-documentation-centric.
