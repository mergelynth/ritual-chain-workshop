"use client";

import { Badge, Card, CardBody, CardHeader, Stat } from "@/components/ui"
import { useNow } from "@/hooks/useNow"
import type { Bounty } from "@/lib/bounty"
import { getBountyStatus, STATUS_META } from "@/lib/bounty"
import {
	formatRelative,
	formatReward,
	formatTimestamp,
	shortenAddress,
} from "@/lib/format"

export function BountyDetail({
  bountyId,
  bounty,
  isOwner,
}: {
  bountyId: bigint;
  bounty: Bounty;
  isOwner: boolean;
}) {
  const now = useNow();
  const status = getBountyStatus(bounty, now / 1000);
  const meta = STATUS_META[status];

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-zinc-500">
              #{bountyId.toString()}
            </span>

            <span className="text-base text-zinc-100">
              {bounty.title || "Untitled"}
            </span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {isOwner && <Badge tone="indigo">You own this</Badge>}
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        }
      />

      <CardBody className="space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">
            Rubric
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-200">
            {bounty.rubric || "-"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Reward"
            value={formatReward(bounty.reward)}
          />

          <Stat
            label="Judged"
            value={bounty.judged ? "Yes" : "No"}
          />

          <Stat
            label="Finalized"
            value={bounty.finalized ? "Yes" : "No"}
          />

          <Stat
            label="Commitments"
            value={bounty.commitmentCount.toString()}
          />

          <Stat
            label="Revealed"
            value={bounty.revealedCount.toString()}
          />

          <Stat
            label="Commit deadline"
            value={
              <span>
                {formatTimestamp(bounty.commitDeadline)}
                <span className="ml-1 text-xs text-zinc-500">
                  ({formatRelative(bounty.commitDeadline)})
                </span>
              </span>
            }
          />

          <Stat
            label="Reveal deadline"
            value={
              <span>
                {formatTimestamp(bounty.revealDeadline)}
                <span className="ml-1 text-xs text-zinc-500">
                  ({formatRelative(bounty.revealDeadline)})
                </span>
              </span>
            }
          />

          <Stat
            label="Owner"
            value={shortenAddress(bounty.owner)}
          />
        </div>

        {bounty.judged && bounty.aiReview !== "0x" && (
          <div className="rounded-xl bg-zinc-900/70 p-3 ring-1 ring-zinc-800">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              AI Review
            </div>

            <div className="overflow-x-auto break-all font-mono text-xs text-zinc-300">
              {bounty.aiReview}
            </div>
          </div>
        )}

        {bounty.finalized && (
          <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-inset ring-emerald-500/30">
            Winner submission #{bounty.winnerIndex.toString()}
          </div>
        )}
      </CardBody>
    </Card>
  );
}