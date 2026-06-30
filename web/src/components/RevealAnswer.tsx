"use client";

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"

import aiJudgeAbi from "@/abi/AIJudge"
import { contractAddress } from "@/config/contract"
import { ritualChain } from "@/config/wagmi"

import { useNow } from "@/hooks/useNow"
import { useWriteTx } from "@/hooks/useWriteTx"
import { canReveal, type Bounty } from "@/lib/bounty"

import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Notice,
	TxStatus,
} from "@/components/ui"

const explorerBase = ritualChain.blockExplorers?.default.url;

type SavedCommitment = {
  answer: string;
  salt: `0x${string}`;
};

export function RevealAnswer({
  bountyId,
  bounty,
  onRevealed,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onRevealed: () => void;
}) {
  const { isConnected } = useAccount();
  const now = useNow();

  const [saved, setSaved] = useState<SavedCommitment | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem(`bounty-${bountyId.toString()}`);

    if (!raw) {
      setSaved(null);
      return;
    }

    try {
      setSaved(JSON.parse(raw));
    } catch {
      setSaved(null);
    }
  }, [bountyId]);

  const tx = useWriteTx(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`bounty-${bountyId.toString()}`);
    }

    setSaved(null);
    onRevealed();
  });

  if (!canReveal(bounty, now / 1000)) {
    return null;
  }

  async function handleReveal() {
    if (!saved || !contractAddress) return;

    try {
      await tx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "revealAnswer",
        args: [
          bountyId,
          saved.answer,
          saved.salt,
        ],
        chainId: ritualChain.id,
      });
    } catch {
      // error handled by useWriteTx
    }
  }

  return (
    <Card>
      <CardHeader
        title="Reveal answer"
        subtitle="Reveal the answer you committed earlier."
      />

      <CardBody className="space-y-3">
        {!saved ? (
          <Notice tone="amber">
            No locally stored commitment was found for this bounty.
          </Notice>
        ) : (
          <>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                Stored answer
              </div>

              <p className="whitespace-pre-wrap text-sm text-zinc-200">
                {saved.answer}
              </p>
            </div>

            <Button
              className="w-full"
              disabled={!isConnected || tx.isBusy}
              onClick={handleReveal}
            >
              {tx.isBusy ? "Revealing..." : "Reveal answer"}
            </Button>
          </>
        )}

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