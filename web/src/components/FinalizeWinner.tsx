"use client";

import aiJudgeAbi from "@/abi/AIJudge"
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Field,
	Input,
	Notice,
	TxStatus,
} from "@/components/ui"
import { contractAddress } from "@/config/contract"
import { ritualChain } from "@/config/wagmi"
import { useWriteTx } from "@/hooks/useWriteTx"
import { decodeAiReview } from "@/lib/aiReview"
import type { Bounty } from "@/lib/bounty"
import { formatReward } from "@/lib/format"
import { useState } from "react"

const explorerBase = ritualChain.blockExplorers?.default.url;

export function FinalizeWinner({
  bountyId,
  bounty,
  isOwner,
  onFinalized,
}: {
  bountyId: bigint;
  bounty: Bounty;
  isOwner: boolean;
  onFinalized: () => void;
}) {
  const count = Number(bounty.revealedCount);
  const recommended = decodeAiReview(bounty.aiReview)?.parsed?.winnerIndex;

  // The input is prefilled with the AI recommendation until the owner edits it.
  // `override === null` means "untouched, show the recommendation".
  const [override, setOverride] = useState<string | null>(null);
  const winnerIndex =
    override ?? (recommended !== undefined ? String(recommended) : "");

  const tx = useWriteTx(() => onFinalized());

  // Gate per spec: owner only, judged, not finalized.
  if (!isOwner || !bounty.judged || bounty.finalized) return null;

  const idxNum = Number(winnerIndex);
  const valid =
    winnerIndex !== "" &&
    Number.isInteger(idxNum) &&
    idxNum >= 0 &&
    idxNum < count;

  async function handleFinalize() {
    if (!valid || !contractAddress) return;
    try {
      await tx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "finalizeWinner",
        args: [bountyId, BigInt(idxNum)],
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Finalize winner"
        subtitle="Pays the reward to the chosen submission. Only one winner."
      />
      <CardBody className="space-y-3">
        <Notice tone="zinc">
          Only one winner receives the bounty reward (
          {formatReward(bounty.reward)}).
        </Notice>

        <Field
          label="Winner index"
          hint={
            recommended !== undefined
              ? `AI recommends #${recommended}. You decide the final winner.`
              : `Choose a submission index (0–${Math.max(count - 1, 0)}).`
          }
        >
          <Input
            type="number"
            min={0}
            max={Math.max(count - 1, 0)}
            value={winnerIndex}
            onChange={(e) => setOverride(e.target.value)}
          />
        </Field>

        {winnerIndex !== "" && !valid && (
          <p className="text-xs text-amber-300">
            Index must be between 0 and {Math.max(count - 1, 0)}.
          </p>
        )}

        <Button
          onClick={handleFinalize}
          disabled={!valid || tx.isBusy}
          className="w-full"
        >
          {tx.isBusy ? "Finalizing…" : "Finalize winner"}
        </Button>

        <TxStatus
          state={tx.state}
          error={tx.error}
          hash={tx.hash}
          explorerBase={explorerBase}
        />
      </CardBody>
    </Card>
  );
}
