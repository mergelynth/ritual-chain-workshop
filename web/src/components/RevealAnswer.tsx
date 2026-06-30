"use client";

import { useMemo } from "react"
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

export function RevealAnswer({
  bountyId,
  bounty,
  onRevealed,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onRevealed: () => void;
}) {
  const { address, isConnected } = useAccount();
  const now = useNow();

  const tx = useWriteTx(() => {
    localStorage.removeItem(`bounty-${bountyId.toString()}`);
    onRevealed();
  });

  if (!canReveal(bounty, now / 1000)) {
    return null;
  }

  const saved = useMemo(() => {
    if (typeof window === "undefined") return null;

    const raw = localStorage.getItem(`bounty-${bountyId.toString()}`);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as {
        answer: string;
        salt: `0x${string}`;
      };
    } catch {
      return null;
    }
  }, [bountyId]);

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
    } catch {}
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
            No locally stored commitment was found for this wallet.
          </Notice>
        ) : (
          <>
            <div className="rounded-xl bg-black/20 border border-white/10 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
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