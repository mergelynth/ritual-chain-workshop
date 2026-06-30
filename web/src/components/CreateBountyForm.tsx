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
	Textarea,
	TxStatus,
} from "@/components/ui"
import { contractAddress, isContractConfigured } from "@/config/contract"
import { ritualChain } from "@/config/wagmi"
import { useWriteTx } from "@/hooks/useWriteTx"
import { useState } from "react"
import { parseEther, parseEventLogs } from "viem"
import { useAccount } from "wagmi"

const explorerBase = ritualChain.blockExplorers?.default.url;

function defaultDeadline(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function CreateBountyForm({ onCreated }: { onCreated?: (bountyId: bigint) => void }) {
  const { isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [rubric, setRubric] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline(60 * 60 * 1000));
  const [revealDeadline, setRevealDeadline] = useState(defaultDeadline(2 * 60 * 60 * 1000));
  const [reward, setReward] = useState("");
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  const tx = useWriteTx((receipt) => {
    try {
      const logs = parseEventLogs({
        abi: aiJudgeAbi,
        eventName: "BountyCreated",
        logs: receipt.logs,
      });
      const id = logs[0]?.args?.bountyId;
      if (id !== undefined) {
        setCreatedId(id);
        onCreated?.(id);
      }
    } catch {
      /* couldn't decode — not fatal */
    }
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !rubric.trim() || !deadline || !contractAddress) return;

    const submissionDeadlineTs = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
    const revealDeadlineTs = BigInt(Math.floor(new Date(revealDeadline).getTime() / 1000));
    const value = reward.trim() === "" ? 0n : parseEther(reward.trim());
    setCreatedId(null);

    try {
      await tx.run({
        address: contractAddress,
        abi: aiJudgeAbi,
        functionName: "createBounty",
        args: [title.trim(), rubric.trim(), submissionDeadlineTs, revealDeadlineTs],
        value,
        chainId: ritualChain.id,
      });
    } catch {
      /* surfaced via tx.state */
    }
  }

  return (
    <Card>
      <CardHeader title="Create a bounty" subtitle="Fund a reward and set a deadline." />
      <CardBody>
        {!isContractConfigured && (
          <Notice tone="amber">
            Set <code className="font-mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your{" "}
            <code className="font-mono">.env.local</code> to enable transactions.
          </Notice>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Rubric">
            <Textarea value={rubric} onChange={(e) => setRubric(e.target.value)} rows={4} />
          </Field>
					<Field label="Submission deadline">
						<Input
							type="datetime-local"
							value={deadline}
							onChange={(e) => setDeadline(e.target.value)}
						/>
					</Field>

					<Field label="Reveal deadline">
						<Input
							type="datetime-local"
							value={revealDeadline}
							onChange={(e) => setRevealDeadline(e.target.value)}
						/>
					</Field>
					<Field label="Reward (RITUAL)">
            <Input
              type="number"
              min="0"
              step="any"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="1.0"
            />
          </Field>

          <Button
            type="submit"
            disabled={!isConnected || !isContractConfigured || tx.isBusy}
            className="w-full"
          >
            {tx.isBusy ? "Creating…" : "Create bounty"}
          </Button>

          {!isConnected && (
            <p className="text-xs text-zinc-500">Connect your wallet to create a bounty.</p>
          )}

          <TxStatus state={tx.state} error={tx.error} hash={tx.hash} explorerBase={explorerBase} />

          {createdId !== null && (
            <Notice tone="green">
              Bounty created with id{" "}
              <span className="font-mono font-semibold">#{createdId.toString()}</span>.
            </Notice>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
