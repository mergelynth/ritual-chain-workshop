## Privacy-Preserving AI Bounty Judge — Homework

This repo extends the workshop starter (`/hardhat` — smart contract,
`/web` — Next.js frontend) with the **Required Track** of the homework:
a commit-reveal bounty lifecycle so answers stay hidden until judging is
complete.

### Where everything is

| Deliverable | Location |
|---|---|
| Updated Solidity contract (commit-reveal) | [`hardhat/contracts/AIJudge.sol`](hardhat/contracts/AIJudge.sol) |
| Mock Ritual LLM precompile (for local tests) | [`hardhat/contracts/mocks/MockLLMPrecompile.sol`](hardhat/contracts/mocks/MockLLMPrecompile.sol) |
| Tests (commit-reveal, access control, payouts, judging) | [`hardhat/test/AIJudge.ts`](hardhat/test/AIJudge.ts) |
| Test plan (what's covered and why) | [`TEST_PLAN.md`](TEST_PLAN.md) |
| Bounty lifecycle README | [`hardhat/README.md`](hardhat/README.md) |
| Architecture note — commit-reveal vs. Ritual-native (Advanced Track design) | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Reflection question answer | [`REFLECTION.md`](REFLECTION.md) |
| ABI auto-sync script (`hardhat` artifacts → `web/src/abi`) | [`hardhat/scripts/sync-abi.ts`](hardhat/scripts/sync-abi.ts) |
| Full local setup / test / deploy / GitHub publishing guide | [`SETUP.md`](SETUP.md) |

### Quick start

```bash
cd hardhat && pnpm install && npx hardhat compile && npx hardhat test
```

See [`SETUP.md`](SETUP.md) for the complete walkthrough, from creating
`.env` files through testing, deployment, and pushing to GitHub.

### Frontend (`/web`) — explicitly out of scope

The PDF's deliverables and evaluation criteria are 100% contract-centric
(Solidity + tests + README + architecture note). `/web` is not mentioned
anywhere in the homework and is not graded. It is **left untouched** here on
purpose, at the original workshop's old single-deadline ABI
(`createBounty(title, rubric, deadline)`, `submitAnswer(...)`, single
`getBounty` tuple shape).

Because the deployed contract is the new commit-reveal version, calling
`createBounty` / `submitAnswer` from this unmodified UI will revert (selector
mismatch — the old 3-arg `createBounty` and `submitAnswer` no longer exist in
the new ABI). That's expected and does not affect the homework grade. If you
want a working demo UI later, that's a separate, optional follow-up — not
part of this submission.

---



/hardhat -> Where we'll write the smart contract

/web -> Where the frontend lives.
