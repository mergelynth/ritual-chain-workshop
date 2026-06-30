"use client";

import { AIReviewDisplay } from "@/components/AIReviewDisplay"
import { BountyDetail } from "@/components/BountyDetail"
import { FinalizeWinner } from "@/components/FinalizeWinner"
import { JudgeAll } from "@/components/JudgeAll"
import { RevealAnswer } from "@/components/RevealAnswer"
import { SubmissionsList } from "@/components/SubmissionsList"
import { SubmitAnswer } from "@/components/SubmitAnswer"
import { Card, CardBody, Notice, Spinner } from "@/components/ui"
import { useBounty } from "@/hooks/useBounty"
import { decodeAiReview } from "@/lib/aiReview"
import { isAddressEqual } from "@/lib/format"
import { useCallback } from "react"
import { useAccount } from "wagmi"


export function BountyView({ bountyId }: { bountyId: bigint }) {
  const { address } = useAccount();
  const { bounty, isLoading, isError, refetch } = useBounty(bountyId);

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Spinner /> Loading bounty #{bountyId.toString()}…
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError || !bounty) {
    return (
      <Notice tone="red">
        Couldn&apos;t load bounty #{bountyId.toString()}. Check the id and that the
        contract address / RPC are configured correctly.
      </Notice>
    );
  }

  // An owner of address(0) means the bounty doesn't exist yet.
  if (/^0x0+$/.test(bounty.owner)) {
    return (
      <Notice tone="amber">
        Bounty #{bountyId.toString()} doesn&apos;t exist.
      </Notice>
    );
  }

  const isOwner = isAddressEqual(address, bounty.owner);
  const judge = decodeAiReview(bounty.aiReview)?.parsed ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left column: details + owner/participant actions */}
      <div className="space-y-4">
        <BountyDetail bountyId={bountyId} bounty={bounty} isOwner={isOwner} />
        <SubmitAnswer
          bountyId={bountyId}
          bounty={bounty}
          onSubmitted={reload}
        />
				<RevealAnswer
					bountyId={bountyId}
					bounty={bounty}
					onRevealed={reload}
				/>
        <JudgeAll
          bountyId={bountyId}
          bounty={bounty}
          isOwner={isOwner}
          onJudged={reload}
        />
        <FinalizeWinner
          bountyId={bountyId}
          bounty={bounty}
          isOwner={isOwner}
          onFinalized={reload}
        />
      </div>

      {/* Right column: AI review + submissions */}
      <div className="space-y-4">
        {bounty.judged && <AIReviewDisplay aiReview={bounty.aiReview} />}
        <SubmissionsList
          bountyId={bountyId}
          count={Number(bounty.revealedCount)}
          judge={judge}
          finalWinner={
            bounty.finalized ? Number(bounty.winnerIndex) : undefined
          }
        />
      </div>
    </div>
  );
}
