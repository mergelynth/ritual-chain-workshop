import { hexToString } from "viem"

export type RankingEntry = {
  index: number;
  score: number;
  reason: string;
};

export type JudgeResult = {
  winnerIndex: number;
  ranking: RankingEntry[];
  summary: string;
};

export type DecodedAiReview = {
  raw: string;
  parsed: JudgeResult | null;
};

const EMPTY_BYTES = new Set(["", "0x"]);

export function decodeAiReview(
  aiReviewHex?: string,
): DecodedAiReview | null {
  if (!aiReviewHex || EMPTY_BYTES.has(aiReviewHex)) return null;

  let raw: string;

  try {
    raw = hexToString(aiReviewHex as `0x${string}`);
  } catch {
    raw = aiReviewHex;
  }

  return {
    raw,
    parsed: tryParseJudgeResult(raw),
  };
}

function tryParseJudgeResult(text: string): JudgeResult | null {
  const candidate = extractJson(text);

  if (!candidate) return null;

  let obj: unknown;

  try {
    obj = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (!obj || typeof obj !== "object") return null;

  const o = obj as Record<string, unknown>;

  const winnerIndex = safeNumber(o.winnerIndex);

  if (winnerIndex === null) return null;

  const ranking: RankingEntry[] = Array.isArray(o.ranking)
    ? o.ranking
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;

          const e = entry as Record<string, unknown>;

          const index = safeNumber(e.index);

          if (index === null) return null;

          return {
            index,
            score: safeScore(e.score),
            reason:
              typeof e.reason === "string"
                ? e.reason
                : String(e.reason ?? ""),
          };
        })
        .filter((v): v is RankingEntry => v !== null)
    : [];

  return {
    winnerIndex,
    ranking,
    summary:
      typeof o.summary === "string"
        ? o.summary
        : String(o.summary ?? ""),
  };
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function safeScore(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);

    if (match) {
      const parsed = Number(match[0]);

      if (Number.isFinite(parsed)) return parsed;
    }

    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function extractJson(text: string): string | null {
  let t = text.trim();

  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced) {
    t = fenced[1].trim();
  }

  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return t.slice(start, end + 1);
}