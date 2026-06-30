// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockLLMPrecompile
/// @notice Test-only stand-in for the real Ritual LLM inference precompile
/// (address 0x0802). Local Hardhat networks don't run the Ritual node, so
/// there is no code at 0x0802 by default. Tests deploy this contract and use
/// `testClient.setCode` to install its bytecode at 0x0802, letting
/// `AIJudge.judgeAll` exercise the full encode/decode path against a
/// deterministic, configurable response.
///
/// Mirrors the real precompile's response shape for "short-running async
/// precompiles": `abi.encode(bytes simmedInput, bytes actualOutput)`, where
/// `actualOutput` decodes as `(bool hasError, bytes completionData, bytes,
/// string errorMessage, ConvoHistory)`.
contract MockLLMPrecompile {
    struct ConvoHistory {
        string storageType;
        string path;
        string secretsName;
    }

    // NOTE: deliberately stateless. Tests install this contract's *runtime*
    // bytecode at 0x0802 via `testClient.setCode`, which copies code only —
    // not storage. Any state set in a constructor would read back as zero at
    // the target address, so the response is hardcoded as constants instead.

    /// @dev Any calldata is accepted; the mock always returns the same
    /// fixed, valid `judgeAll`-shaped response regardless of input, since
    /// tests only need to verify that AIJudge correctly forwards/decodes the
    /// precompile output end-to-end.
    fallback(bytes calldata input) external returns (bytes memory) {
        bytes memory completionData = bytes(
            '{"winnerIndex":0,"ranking":[{"index":0,"score":95,"reason":"Best satisfies the rubric."}],"summary":"Submission 0 is the strongest answer."}'
        );

        bytes memory actualOutput = abi.encode(
            false,
            completionData,
            bytes(""),
            "",
            ConvoHistory({storageType: "none", path: "", secretsName: ""})
        );

        return abi.encode(input, actualOutput);
    }
}
