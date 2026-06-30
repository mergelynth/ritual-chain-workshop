"use client";

import { useState } from "react"
import { bytesToHex, encodePacked, keccak256 } from "viem"
import { useAccount } from "wagmi"

import aiJudgeAbi from "@/abi/AIJudge"
import { contractAddress } from "@/config/contract"
import { ritualChain } from "@/config/wagmi"
import { useNow } from "@/hooks/useNow"
import { useWriteTx } from "@/hooks/useWriteTx"
import { canCommit, type Bounty } from "@/lib/bounty"

import {
	Button,
	Card,
	CardBody,
	CardHeader,
	Field,
	Textarea,
	TxStatus,
} from "@/components/ui"

const explorerBase = ritualChain.blockExplorers?.default.url;

export function SubmitAnswer({
  bountyId,
  bounty,
  onSubmitted,
}: {
  bountyId: bigint;
  bounty: Bounty;
  onSubmitted: () => void;
}) {
  const now = useNow();
  const { address, isConnected } = useAccount();

  const [answer, setAnswer] = useState("");

  const tx = useWriteTx(() => {
    setAnswer("");
    onSubmitted();
  });

  if (!canCommit(bounty, now / 1000)) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!address || !answer.trim() || !contractAddress) return;

    const bytes = crypto.getRandomValues(new Uint8Array(32));
		const salt = bytesToHex(bytes);

    const commitment = keccak256(
      encodePacked(
        ["string", "bytes32", "address"],
        [answer.trim(), salt as `0x${string}`, address]
      )
    );

    localStorage.setItem(
      `bounty-${bountyId.toString()}`,
      JSON.stringify({
        answer: answer.trim(),
        salt,
      })
    );

    try {
      await tx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "submitCommitment",
        args: [bountyId, commitment],
        chainId: ritualChain.id,
      });
    } catch {}
  }

  return (
    <Card>
      <CardHeader
        title="Commit answer"
        subtitle="Your answer stays secret until the reveal phase."
      />

      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Answer">
            <Textarea
              rows={5}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your answer..."
            />
          </Field>

          <Button
            type="submit"
            className="w-full"
            disabled={!isConnected || !answer.trim() || tx.isBusy}
          >
            {tx.isBusy ? "Submitting..." : "Commit answer"}
          </Button>

          <TxStatus
            state={tx.state}
            error={tx.error}
            hash={tx.hash}
            explorerBase={explorerBase}
          />
        </form>
      </CardBody>
    </Card>
  );
}