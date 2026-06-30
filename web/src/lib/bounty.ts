import type { Address } from "viem"

export type Bounty = {
  owner: Address;
  title: string;
  rubric: string;
  reward: bigint;

  commitDeadline: bigint;
  revealDeadline: bigint;

  judged: boolean;
  finalized: boolean;

  commitmentCount: bigint;
  revealedCount: bigint;

  winnerIndex: bigint;
  aiReview: `0x${string}`;
};

export function parseBounty(raw: readonly any[]): Bounty {
  const [
    owner,
    title,
    rubric,
    reward,
    commitDeadline,
    revealDeadline,
    judged,
    finalized,
    commitmentCount,
    revealedCount,
    winnerIndex,
    aiReview,
  ] = raw;

  return {
    owner,
    title,
    rubric,
    reward,
    commitDeadline,
    revealDeadline,
    judged,
    finalized,
    commitmentCount,
    revealedCount,
    winnerIndex,
    aiReview,
  };
}

export type BountyStatus =
  | "commit"
  | "reveal"
  | "ready"
  | "judged"
  | "finalized";

export const STATUS_META: Record<
  BountyStatus,
  {
    label: string;
    tone: "green" | "amber" | "indigo" | "zinc";
  }
> = {
  commit: {
    label: "Commit phase",
    tone: "green",
  },
  reveal: {
    label: "Reveal phase",
    tone: "amber",
  },
  ready: {
    label: "Ready for judging",
    tone: "amber",
  },
  judged: {
    label: "Judged",
    tone: "indigo",
  },
  finalized: {
    label: "Finalized",
    tone: "zinc",
  },
};

export function getBountyStatus(
  bounty: Bounty,
  nowSeconds = Date.now() / 1000,
): BountyStatus {
  if (bounty.finalized) return "finalized";
  if (bounty.judged) return "judged";

  if (Number(bounty.revealDeadline) <= nowSeconds) {
    return "ready";
  }

  if (Number(bounty.commitDeadline) <= nowSeconds) {
    return "reveal";
  }

  return "commit";
}

export function canCommit(
  bounty: Bounty,
  nowSeconds = Date.now() / 1000,
) {
  return (
    !bounty.judged &&
    !bounty.finalized &&
    Number(bounty.commitDeadline) > nowSeconds
  );
}

export function canReveal(
  bounty: Bounty,
  nowSeconds = Date.now() / 1000,
) {
  return (
    !bounty.judged &&
    !bounty.finalized &&
    Number(bounty.commitDeadline) <= nowSeconds &&
    Number(bounty.revealDeadline) > nowSeconds
  );
}

export function canJudge(
  bounty: Bounty,
  nowSeconds = Date.now() / 1000,
) {
  return (
    !bounty.judged &&
    !bounty.finalized &&
    Number(bounty.revealDeadline) <= nowSeconds &&
    Number(bounty.revealedCount) > 0
  );
}