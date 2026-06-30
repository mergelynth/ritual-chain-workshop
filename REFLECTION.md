# Reflection

**What should be public, what should stay hidden, and what should be decided
by AI versus by a human in a bounty system?**

The bounty's terms should be public from the start: the title, rubric,
reward amount, and both deadlines, since participants need this to decide
whether to compete and how to be judged fairly. The number of commitments
received is fine to expose too, as it carries no information about content.
What must stay hidden is the answer itself, until judging is complete —
that's the entire point of a bounty with one winner, since any participant
who can read another's answer early can copy or out-compete it for free. A
commitment hash is a reasonable thing to make public early, because it
reveals nothing about the content but still proves, after the fact, that the
answer existed and was unchanged at submission time. Deciding *who wins*
should be a hybrid: the AI is well-suited to do the first, most tedious pass
— reading every revealed answer against a fixed rubric in one batched call
and producing a ranking — because it is fast, consistent, and free of social
bias toward any particular participant. But a human, specifically the bounty
owner, should retain the final say over the payout, since the AI's ranking
could be wrong, gamed by adversarial input, or based on a rubric the owner
later realizes was ambiguous; an irreversible token transfer is too high-
stakes to execute purely on unverified model output. In short: public
metadata to keep the market fair, hidden content to keep the contest fair,
AI for fast structured evaluation, and a human in the loop for the
irreversible final decision.
