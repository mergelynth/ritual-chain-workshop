import { network } from "hardhat";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  encodePacked,
  keccak256,
  toHex,
  parseEther,
  type Hex,
} from "viem";

const { viem, networkHelpers } = await network.create();

const LLM_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000802";

const ONE_HOUR = 60n * 60n;

/** Builds the commit-reveal hash exactly as AIJudge.sol does. */
function buildCommitment(
  answer: string,
  salt: Hex,
  sender: `0x${string}`,
  bountyId: bigint,
) {
  return keccak256(
    encodePacked(
      ["string", "bytes32", "address", "uint256"],
      [answer, salt, sender, bountyId],
    ),
  );
}

function randomSalt(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Installs the mock Ritual LLM precompile's runtime bytecode at 0x0802. */
async function installMockPrecompile() {
  const mock = await viem.deployContract("MockLLMPrecompile");
  const publicClient = await viem.getPublicClient();
  const bytecode = await publicClient.getCode({ address: mock.address });
  if (!bytecode) throw new Error("failed to read mock precompile bytecode");

  const testClient = await viem.getTestClient();
  await testClient.setCode({
    address: LLM_PRECOMPILE_ADDRESS,
    bytecode,
  });
}

async function deployAIJudge() {
  await installMockPrecompile();
  const aiJudge = await viem.deployContract("AIJudge");
  const [owner, alice, bob, carol] = await viem.getWalletClients();
  return { aiJudge, owner, alice, bob, carol };
}

/** Creates a bounty with a 1h submission window and 1h reveal window. */
async function createBounty(
  aiJudge: Awaited<ReturnType<typeof viem.deployContract>>,
  reward = parseEther("1"),
) {
  const now = BigInt(await networkHelpers.time.latest());
  const submissionDeadline = now + ONE_HOUR;
  const revealDeadline = submissionDeadline + ONE_HOUR;

  const hash = await aiJudge.write.createBounty(
    ["Best Solidity one-liner", "Correctness, gas, readability", submissionDeadline, revealDeadline],
    { value: reward },
  );

  return { hash, submissionDeadline, revealDeadline };
}

describe("AIJudge — commit-reveal bounty", () => {
  describe("createBounty", () => {
    it("stores the bounty and emits BountyCreated", async () => {
      const { aiJudge, owner } = await deployAIJudge();
      const { submissionDeadline, revealDeadline } = await (async () => {
        const now = BigInt(await networkHelpers.time.latest());
        return {
          submissionDeadline: now + ONE_HOUR,
          revealDeadline: now + 2n * ONE_HOUR,
        };
      })();

      await viem.assertions.emitWithArgs(
        aiJudge.write.createBounty(
          ["Title", "Rubric", submissionDeadline, revealDeadline],
          { value: parseEther("1") },
        ),
        aiJudge,
        "BountyCreated",
        [1n, owner.account.address, "Title", parseEther("1"), submissionDeadline, revealDeadline],
      );
    });

    it("rejects a zero reward", async () => {
      const { aiJudge } = await deployAIJudge();
      const now = BigInt(await networkHelpers.time.latest());
      await viem.assertions.revertWith(
        aiJudge.write.createBounty(["T", "R", now + ONE_HOUR, now + 2n * ONE_HOUR], {
          value: 0n,
        }),
        "reward required",
      );
    });

    it("rejects a reveal deadline before the submission deadline", async () => {
      const { aiJudge } = await deployAIJudge();
      const now = BigInt(await networkHelpers.time.latest());
      await viem.assertions.revertWith(
        aiJudge.write.createBounty(["T", "R", now + 2n * ONE_HOUR, now + ONE_HOUR], {
          value: parseEther("1"),
        }),
        "reveal deadline before submission deadline",
      );
    });
  });

  describe("submitCommitment", () => {
    it("accepts a hidden commitment during the submission phase", async () => {
      const { aiJudge, alice } = await deployAIJudge();
      await createBounty(aiJudge);

      const bountyId = 1n;
      const salt = randomSalt();
      const commitment = buildCommitment("answer A", salt, alice.account.address, bountyId);

      await viem.assertions.emitWithArgs(
        aiJudge.write.submitCommitment([bountyId, commitment], {
          account: alice.account,
        }),
        aiJudge,
        "AnswerCommitted",
        [bountyId, 0n, alice.account.address, commitment],
      );

      const [submitter, storedCommitment, revealed] = await aiJudge.read.getCommitment([
        bountyId,
        0n,
      ]);
      assert.equal(submitter.toLowerCase(), alice.account.address.toLowerCase());
      assert.equal(storedCommitment, commitment);
      assert.equal(revealed, false);
    });

    it("never exposes the plaintext answer on-chain before reveal", async () => {
      const { aiJudge, alice } = await deployAIJudge();
      await createBounty(aiJudge);

      const bountyId = 1n;
      const salt = randomSalt();
      const secretAnswer = "totally secret answer nobody should see yet";
      const commitment = buildCommitment(secretAnswer, salt, alice.account.address, bountyId);

      await aiJudge.write.submitCommitment([bountyId, commitment], {
        account: alice.account,
      });

      // Only the hash is queryable; there is no path to the plaintext answer
      // before a reveal happens (submissions array is still empty).
      const bounty = await aiJudge.read.getBounty([bountyId]);
      assert.equal(bounty[9], 0n); // revealedCount
      await viem.assertions.revert(aiJudge.read.getSubmission([bountyId, 0n]));
    });

    it("rejects a second commitment from the same participant", async () => {
      const { aiJudge, alice } = await deployAIJudge();
      await createBounty(aiJudge);
      const bountyId = 1n;

      const commitment1 = buildCommitment("a1", randomSalt(), alice.account.address, bountyId);
      const commitment2 = buildCommitment("a2", randomSalt(), alice.account.address, bountyId);

      await aiJudge.write.submitCommitment([bountyId, commitment1], {
        account: alice.account,
      });

      await viem.assertions.revertWith(
        aiJudge.write.submitCommitment([bountyId, commitment2], {
          account: alice.account,
        }),
        "already committed",
      );
    });

    it("rejects commitments submitted after the submission deadline", async () => {
      const { aiJudge, alice } = await deployAIJudge();
      const { submissionDeadline } = await createBounty(aiJudge);
      const bountyId = 1n;

      await networkHelpers.time.increaseTo(submissionDeadline + 1n);

      const commitment = buildCommitment("late", randomSalt(), alice.account.address, bountyId);
      await viem.assertions.revertWith(
        aiJudge.write.submitCommitment([bountyId, commitment], {
          account: alice.account,
        }),
        "submission phase closed",
      );
    });
  });

  describe("revealAnswer", () => {
    async function setupTwoCommitments() {
      const ctx = await deployAIJudge();
      const { submissionDeadline, revealDeadline } = await createBounty(ctx.aiJudge);
      const bountyId = 1n;

      const aliceSalt = randomSalt();
      const aliceAnswer = "alice's answer";
      const aliceCommitment = buildCommitment(
        aliceAnswer,
        aliceSalt,
        ctx.alice.account.address,
        bountyId,
      );

      const bobSalt = randomSalt();
      const bobAnswer = "bob's answer";
      const bobCommitment = buildCommitment(bobAnswer, bobSalt, ctx.bob.account.address, bountyId);

      await ctx.aiJudge.write.submitCommitment([bountyId, aliceCommitment], {
        account: ctx.alice.account,
      });
      await ctx.aiJudge.write.submitCommitment([bountyId, bobCommitment], {
        account: ctx.bob.account,
      });

      return {
        ...ctx,
        bountyId,
        submissionDeadline,
        revealDeadline,
        aliceSalt,
        aliceAnswer,
        bobSalt,
        bobAnswer,
      };
    }

    it("rejects reveals before the submission deadline", async () => {
      const ctx = await setupTwoCommitments();
      await viem.assertions.revertWith(
        ctx.aiJudge.write.revealAnswer([ctx.bountyId, ctx.aliceAnswer, ctx.aliceSalt], {
          account: ctx.alice.account,
        }),
        "reveal phase not started",
      );
    });

    it("accepts a matching reveal during the reveal window", async () => {
      const ctx = await setupTwoCommitments();
      await networkHelpers.time.increaseTo(ctx.submissionDeadline + 1n);

      await viem.assertions.emitWithArgs(
        ctx.aiJudge.write.revealAnswer([ctx.bountyId, ctx.aliceAnswer, ctx.aliceSalt], {
          account: ctx.alice.account,
        }),
        ctx.aiJudge,
        "AnswerRevealed",
        [ctx.bountyId, 0n, ctx.alice.account.address],
      );

      const [submitter, answer] = await ctx.aiJudge.read.getSubmission([ctx.bountyId, 0n]);
      assert.equal(submitter.toLowerCase(), ctx.alice.account.address.toLowerCase());
      assert.equal(answer, ctx.aliceAnswer);
    });

    it("rejects a reveal with a mismatched answer or salt", async () => {
      const ctx = await setupTwoCommitments();
      await networkHelpers.time.increaseTo(ctx.submissionDeadline + 1n);

      await viem.assertions.revertWith(
        ctx.aiJudge.write.revealAnswer([ctx.bountyId, "wrong answer", ctx.aliceSalt], {
          account: ctx.alice.account,
        }),
        "commitment mismatch",
      );
    });

    it("rejects a reveal attempt for someone else's commitment", async () => {
      const ctx = await setupTwoCommitments();
      await networkHelpers.time.increaseTo(ctx.submissionDeadline + 1n);

      // carol never committed, so she has nothing to reveal.
      await viem.assertions.revertWith(
        ctx.aiJudge.write.revealAnswer([ctx.bountyId, ctx.aliceAnswer, ctx.aliceSalt], {
          account: ctx.carol.account,
        }),
        "no commitment found",
      );
    });

    it("prevents copying someone else's commitment and revealing under it", async () => {
      // Even if Bob learns Alice's (answer, salt) pair, he cannot reveal it
      // as his own submission because the hash binds `msg.sender`.
      const ctx = await setupTwoCommitments();
      await networkHelpers.time.increaseTo(ctx.submissionDeadline + 1n);

      await viem.assertions.revertWith(
        ctx.aiJudge.write.revealAnswer([ctx.bountyId, ctx.aliceAnswer, ctx.aliceSalt], {
          account: ctx.bob.account,
        }),
        "commitment mismatch",
      );
    });

    it("rejects a double reveal", async () => {
      const ctx = await setupTwoCommitments();
      await networkHelpers.time.increaseTo(ctx.submissionDeadline + 1n);

      await ctx.aiJudge.write.revealAnswer([ctx.bountyId, ctx.aliceAnswer, ctx.aliceSalt], {
        account: ctx.alice.account,
      });

      await viem.assertions.revertWith(
        ctx.aiJudge.write.revealAnswer([ctx.bountyId, ctx.aliceAnswer, ctx.aliceSalt], {
          account: ctx.alice.account,
        }),
        "already revealed",
      );
    });

    it("rejects reveals after the reveal deadline", async () => {
      const ctx = await setupTwoCommitments();
      await networkHelpers.time.increaseTo(ctx.revealDeadline + 1n);

      await viem.assertions.revertWith(
        ctx.aiJudge.write.revealAnswer([ctx.bountyId, ctx.aliceAnswer, ctx.aliceSalt], {
          account: ctx.alice.account,
        }),
        "reveal phase closed",
      );
    });

    it("leaves an unrevealed commitment out of judging", async () => {
      const ctx = await setupTwoCommitments();
      await networkHelpers.time.increaseTo(ctx.submissionDeadline + 1n);

      // Only Alice reveals; Bob stays silent.
      await ctx.aiJudge.write.revealAnswer([ctx.bountyId, ctx.aliceAnswer, ctx.aliceSalt], {
        account: ctx.alice.account,
      });

      const bounty = await ctx.aiJudge.read.getBounty([ctx.bountyId]);
      assert.equal(bounty[8], 2n); // commitmentCount
      assert.equal(bounty[9], 1n); // revealedCount (Bob excluded)
    });
  });

  describe("judgeAll", () => {
    async function setupRevealed() {
      const ctx = await deployAIJudge();
      const { submissionDeadline, revealDeadline } = await createBounty(ctx.aiJudge);
      const bountyId = 1n;

      const salt = randomSalt();
      const answer = "the winning answer";
      const commitment = buildCommitment(answer, salt, ctx.alice.account.address, bountyId);

      await ctx.aiJudge.write.submitCommitment([bountyId, commitment], {
        account: ctx.alice.account,
      });

      await networkHelpers.time.increaseTo(submissionDeadline + 1n);
      await ctx.aiJudge.write.revealAnswer([bountyId, answer, salt], {
        account: ctx.alice.account,
      });

      return { ...ctx, bountyId, revealDeadline };
    }

    it("rejects judging before the reveal deadline", async () => {
      const ctx = await setupRevealed();
      await viem.assertions.revertWith(
        ctx.aiJudge.write.judgeAll([ctx.bountyId, "0x"]),
        "reveal phase not finished",
      );
    });

    it("rejects judging by a non-owner", async () => {
      const ctx = await setupRevealed();
      await networkHelpers.time.increaseTo(ctx.revealDeadline + 1n);

      await viem.assertions.revertWith(
        ctx.aiJudge.write.judgeAll([ctx.bountyId, "0x"], { account: ctx.alice.account }),
        "not bounty owner",
      );
    });

    it("rejects judging with zero revealed submissions", async () => {
      const ctx = await deployAIJudge();
      const { revealDeadline } = await createBounty(ctx.aiJudge);
      await networkHelpers.time.increaseTo(revealDeadline + 1n);

      await viem.assertions.revertWith(
        ctx.aiJudge.write.judgeAll([1n, "0x"]),
        "no revealed submissions",
      );
    });

    it("judges all revealed submissions in a single batched call and stores the AI review", async () => {
      const ctx = await setupRevealed();
      await networkHelpers.time.increaseTo(ctx.revealDeadline + 1n);

      await viem.assertions.emit(
        ctx.aiJudge.write.judgeAll([ctx.bountyId, "0x"]),
        ctx.aiJudge,
        "AllAnswersJudged",
      );

      const bounty = await ctx.aiJudge.read.getBounty([ctx.bountyId]);
      assert.equal(bounty[6], true); // judged
      assert.ok((bounty[11] as string).length > 2); // aiReview bytes populated
    });

    it("rejects judging twice", async () => {
      const ctx = await setupRevealed();
      await networkHelpers.time.increaseTo(ctx.revealDeadline + 1n);
      await ctx.aiJudge.write.judgeAll([ctx.bountyId, "0x"]);

      await viem.assertions.revertWith(
        ctx.aiJudge.write.judgeAll([ctx.bountyId, "0x"]),
        "already judged",
      );
    });
  });

  describe("finalizeWinner", () => {
    async function setupJudged() {
      const ctx = await deployAIJudge();
      const { submissionDeadline, revealDeadline } = await createBounty(ctx.aiJudge, parseEther("2"));
      const bountyId = 1n;

      const salt = randomSalt();
      const answer = "the winning answer";
      const commitment = buildCommitment(answer, salt, ctx.alice.account.address, bountyId);

      await ctx.aiJudge.write.submitCommitment([bountyId, commitment], {
        account: ctx.alice.account,
      });

      await networkHelpers.time.increaseTo(submissionDeadline + 1n);
      await ctx.aiJudge.write.revealAnswer([bountyId, answer, salt], {
        account: ctx.alice.account,
      });

      await networkHelpers.time.increaseTo(revealDeadline + 1n);
      await ctx.aiJudge.write.judgeAll([bountyId, "0x"]);

      return { ...ctx, bountyId };
    }

    it("rejects finalizing before judging", async () => {
      const ctx = await deployAIJudge();
      const { submissionDeadline, revealDeadline } = await createBounty(ctx.aiJudge);
      const bountyId = 1n;
      const salt = randomSalt();
      const commitment = buildCommitment("a", salt, ctx.alice.account.address, bountyId);
      await ctx.aiJudge.write.submitCommitment([bountyId, commitment], {
        account: ctx.alice.account,
      });
      await networkHelpers.time.increaseTo(submissionDeadline + 1n);
      await ctx.aiJudge.write.revealAnswer([bountyId, "a", salt], { account: ctx.alice.account });

      await viem.assertions.revertWith(
        ctx.aiJudge.write.finalizeWinner([bountyId, 0n]),
        "not judged yet",
      );
    });

    it("rejects finalizing by a non-owner", async () => {
      const ctx = await setupJudged();
      await viem.assertions.revertWith(
        ctx.aiJudge.write.finalizeWinner([ctx.bountyId, 0n], { account: ctx.alice.account }),
        "not bounty owner",
      );
    });

    it("rejects an out-of-range winner index", async () => {
      const ctx = await setupJudged();
      await viem.assertions.revertWith(
        ctx.aiJudge.write.finalizeWinner([ctx.bountyId, 5n]),
        "invalid winner index",
      );
    });

    it("pays the winner exactly the bounty reward and marks the bounty finalized", async () => {
      const ctx = await setupJudged();

      await viem.assertions.balancesHaveChanged(ctx.aiJudge.write.finalizeWinner([ctx.bountyId, 0n]), [
        { address: ctx.alice.account.address, amount: parseEther("2") },
        { address: ctx.aiJudge.address, amount: -parseEther("2") },
      ]);

      const bounty = await ctx.aiJudge.read.getBounty([ctx.bountyId]);
      assert.equal(bounty[7], true); // finalized
      assert.equal(bounty[10], 0n); // winnerIndex
      assert.equal(bounty[3], 0n); // reward zeroed out after payout
    });

    it("rejects finalizing twice", async () => {
      const ctx = await setupJudged();
      await ctx.aiJudge.write.finalizeWinner([ctx.bountyId, 0n]);

      await viem.assertions.revertWith(
        ctx.aiJudge.write.finalizeWinner([ctx.bountyId, 0n]),
        "already finalized",
      );
    });
  });

  describe("computeCommitment", () => {
    it("matches the on-chain hash used by submitCommitment/revealAnswer", async () => {
      const { aiJudge, alice } = await deployAIJudge();
      const bountyId = 1n;
      const salt = randomSalt();
      const onChain = await aiJudge.read.computeCommitment([
        "answer",
        salt,
        alice.account.address,
        bountyId,
      ]);
      const offChain = buildCommitment("answer", salt, alice.account.address, bountyId);
      assert.equal(onChain, offChain);
    });
  });
});
