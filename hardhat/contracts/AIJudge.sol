// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PrecompileConsumer} from "./utils/PrecompileConsumer.sol";

interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;

    function depositFor(address user, uint256 lockDuration) external payable;

    function withdraw(uint256 amount) external;

    function balanceOf(address) external view returns (uint256);

    function lockUntil(address) external view returns (uint256);
}

/// @title AIJudge — commit-reveal AI Bounty Judge
/// @notice Required-track homework implementation.
///
/// Lifecycle:
///   create -> commit (hidden) -> reveal -> judgeAll (Ritual LLM precompile) -> finalizeWinner
///
/// Answers are never stored on-chain in plaintext before the reveal phase.
/// Only a `keccak256(answer, salt, sender, bountyId)` commitment is public
/// during the submission window, so later participants cannot read or copy
/// earlier answers before judging.
contract AIJudge is PrecompileConsumer {
    uint256 public constant MAX_SUBMISSIONS = 10;
    uint256 public constant MAX_ANSWER_LENGTH = 2_000;

    uint256 public nextBountyId = 1;

    IRitualWallet wallet =
        IRitualWallet(0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948);

    /// @dev One commitment slot per participant. `revealed` answers double as
    /// the list that gets judged; unrevealed commitments are simply skipped.
    struct Commitment {
        address submitter;
        bytes32 commitment;
        bool revealed;
    }

    /// @dev Populated only after a successful reveal — this is the first
    /// point at which an answer becomes readable on-chain.
    struct Submission {
        address submitter;
        string answer;
    }

    struct Bounty {
        address owner;
        string title;
        string rubric;
        uint256 reward;
        uint256 submissionDeadline;
        uint256 revealDeadline;
        bool judged;
        bool finalized;
        bytes aiReview;
        uint256 winnerIndex;
        Commitment[] commitments;
        Submission[] submissions;
    }

    struct ConvoHistory {
        string storageType;
        string path;
        string secretsName;
    }

    mapping(uint256 => Bounty) public bounties;

    /// @dev bountyId => participant => commitment index (+1, 0 = none).
    /// Lets us enforce "one commitment per participant per bounty" in O(1).
    mapping(uint256 => mapping(address => uint256)) private commitmentIndexPlusOne;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed owner,
        string title,
        uint256 reward,
        uint256 submissionDeadline,
        uint256 revealDeadline
    );

    event AnswerCommitted(
        uint256 indexed bountyId,
        uint256 indexed commitmentIndex,
        address indexed submitter,
        bytes32 commitment
    );

    event AnswerRevealed(
        uint256 indexed bountyId,
        uint256 indexed commitmentIndex,
        address indexed submitter
    );

    event AllAnswersJudged(uint256 indexed bountyId, bytes aiReview);

    event WinnerFinalized(
        uint256 indexed bountyId,
        uint256 indexed winnerIndex,
        address indexed winner,
        uint256 reward
    );

    modifier onlyOwner(uint256 bountyId) {
        require(msg.sender == bounties[bountyId].owner, "not bounty owner");
        _;
    }

    modifier bountyExists(uint256 bountyId) {
        require(bounties[bountyId].owner != address(0), "bounty not found");
        _;
    }

    /// @param submissionDeadline End of the commit phase. Must be in the future.
    /// @param revealDeadline End of the reveal phase. Must be after submissionDeadline.
    function createBounty(
        string calldata title,
        string calldata rubric,
        uint256 submissionDeadline,
        uint256 revealDeadline
    ) external payable returns (uint256 bountyId) {
        require(msg.value > 0, "reward required");
        require(submissionDeadline > _now(), "submission deadline in past");
        require(revealDeadline > submissionDeadline, "reveal deadline before submission deadline");

        bountyId = nextBountyId++;

        Bounty storage bounty = bounties[bountyId];

        bounty.owner = msg.sender;
        bounty.title = title;
        bounty.rubric = rubric;
        bounty.reward = msg.value;
        bounty.submissionDeadline = submissionDeadline;
        bounty.revealDeadline = revealDeadline;
        bounty.winnerIndex = type(uint256).max;

        emit BountyCreated(
            bountyId,
            msg.sender,
            title,
            msg.value,
            submissionDeadline,
            revealDeadline
        );
    }

    /// @notice Submit a hidden commitment. The plaintext answer is never sent
    /// to the chain at this stage — only `keccak256(answer, salt, sender, bountyId)`.
    function submitCommitment(
        uint256 bountyId,
        bytes32 commitment
    ) external bountyExists(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        require(_now() < bounty.submissionDeadline, "submission phase closed");
        require(commitment != bytes32(0), "empty commitment");
        require(
            commitmentIndexPlusOne[bountyId][msg.sender] == 0,
            "already committed"
        );
        require(
            bounty.commitments.length < MAX_SUBMISSIONS,
            "too many submissions"
        );

        bounty.commitments.push(
            Commitment({submitter: msg.sender, commitment: commitment, revealed: false})
        );

        commitmentIndexPlusOne[bountyId][msg.sender] = bounty.commitments.length;

        emit AnswerCommitted(
            bountyId,
            bounty.commitments.length - 1,
            msg.sender,
            commitment
        );
    }

    /// @notice Reveal the plaintext answer + salt for the caller's own commitment.
    /// Only valid during the reveal window, and only the original committer can
    /// reveal (the hash includes `msg.sender`, so nobody else's reveal would match).
    function revealAnswer(
        uint256 bountyId,
        string calldata answer,
        bytes32 salt
    ) external bountyExists(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        require(_now() >= bounty.submissionDeadline, "reveal phase not started");
        require(_now() < bounty.revealDeadline, "reveal phase closed");
        require(bytes(answer).length <= MAX_ANSWER_LENGTH, "answer too long");

        uint256 idxPlusOne = commitmentIndexPlusOne[bountyId][msg.sender];
        require(idxPlusOne != 0, "no commitment found");

        uint256 index = idxPlusOne - 1;
        Commitment storage c = bounty.commitments[index];

        require(!c.revealed, "already revealed");

        bytes32 expected = keccak256(
            abi.encodePacked(answer, salt, msg.sender, bountyId)
        );
        require(expected == c.commitment, "commitment mismatch");

        c.revealed = true;
        bounty.submissions.push(Submission({submitter: msg.sender, answer: answer}));

        emit AnswerRevealed(bountyId, index, msg.sender);
    }

    /// @notice Judge every *revealed* answer in a single batched Ritual LLM
    /// inference call. Unrevealed commitments are simply not part of
    /// `bounty.submissions` and are therefore excluded automatically.
    function judgeAll(
        uint256 bountyId,
        bytes calldata llmInput
    ) external bountyExists(bountyId) onlyOwner(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        require(_now() >= bounty.revealDeadline, "reveal phase not finished");
        require(!bounty.judged, "already judged");
        require(!bounty.finalized, "already finalized");
        require(bounty.submissions.length > 0, "no revealed submissions");

        bytes memory output = _executePrecompile(
            LLM_INFERENCE_PRECOMPILE,
            llmInput
        );

        (
            bool hasError,
            bytes memory completionData,
            ,
            string memory errorMessage,

        ) = abi.decode(output, (bool, bytes, bytes, string, ConvoHistory));

        require(!hasError, errorMessage);

        bounty.judged = true;
        bounty.aiReview = completionData;

        emit AllAnswersJudged(bountyId, completionData);
    }

    function finalizeWinner(
        uint256 bountyId,
        uint256 winnerIndex
    ) external bountyExists(bountyId) onlyOwner(bountyId) {
        Bounty storage bounty = bounties[bountyId];

        require(bounty.judged, "not judged yet");
        require(!bounty.finalized, "already finalized");
        require(winnerIndex < bounty.submissions.length, "invalid winner index");

        bounty.finalized = true;
        bounty.winnerIndex = winnerIndex;

        address winner = bounty.submissions[winnerIndex].submitter;
        uint256 reward = bounty.reward;
        bounty.reward = 0;

        (bool ok, ) = payable(winner).call{value: reward}("");
        require(ok, "payment failed");

        emit WinnerFinalized(bountyId, winnerIndex, winner, reward);
    }

    function getBounty(
        uint256 bountyId
    )
        external
        view
        bountyExists(bountyId)
        returns (
            address owner,
            string memory title,
            string memory rubric,
            uint256 reward,
            uint256 submissionDeadline,
            uint256 revealDeadline,
            bool judged,
            bool finalized,
            uint256 commitmentCount,
            uint256 revealedCount,
            uint256 winnerIndex,
            bytes memory aiReview
        )
    {
        Bounty storage bounty = bounties[bountyId];

        return (
            bounty.owner,
            bounty.title,
            bounty.rubric,
            bounty.reward,
            bounty.submissionDeadline,
            bounty.revealDeadline,
            bounty.judged,
            bounty.finalized,
            bounty.commitments.length,
            bounty.submissions.length,
            bounty.winnerIndex,
            bounty.aiReview
        );
    }

    /// @notice Public commitment metadata (no plaintext answer here).
    function getCommitment(
        uint256 bountyId,
        uint256 index
    )
        external
        view
        bountyExists(bountyId)
        returns (address submitter, bytes32 commitment, bool revealed)
    {
        Bounty storage bounty = bounties[bountyId];
        require(index < bounty.commitments.length, "invalid index");

        Commitment storage c = bounty.commitments[index];
        return (c.submitter, c.commitment, c.revealed);
    }

    /// @notice Only readable after the corresponding participant has revealed.
    function getSubmission(
        uint256 bountyId,
        uint256 index
    )
        external
        view
        bountyExists(bountyId)
        returns (address submitter, string memory answer)
    {
        Bounty storage bounty = bounties[bountyId];

        require(index < bounty.submissions.length, "invalid index");

        Submission storage submission = bounty.submissions[index];

        return (submission.submitter, submission.answer);
    }

    /// @notice Helper for the reveal UI / off-chain tooling to recompute the
    /// expected commitment hash for a given (answer, salt) pair.
    function computeCommitment(
        string calldata answer,
        bytes32 salt,
        address submitter,
        uint256 bountyId
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(answer, salt, submitter, bountyId));
    }

		function _now() internal view returns (uint256) {
				if (block.timestamp > 10_000_000_000) {
						return block.timestamp / 1000;
				}
				return block.timestamp;
		}
}
