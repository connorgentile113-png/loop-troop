/**
 * The /learn world poll: which of the two worlds people are picking.
 *
 * Votes are counted in five-minute buckets and thrown away when the bucket rolls over, so the poll
 * starts from scratch on the hour, at :05, :10 and so on. Like the run throttle in api/run.js this
 * lives in the function instance's memory: one warm instance per class, which is the scale this
 * page is for. No accounts, no cookies, one vote per click.
 */
export const WINDOW_MS = 5 * 60_000;

const buckets = new Map();

const bucketFor = (now) => Math.floor(now / WINDOW_MS);

export function snapshot(now = Date.now()) {
  const bucket = bucketFor(now);
  for (const key of buckets.keys()) if (key < bucket) buckets.delete(key);

  const votes = buckets.get(bucket) || { survival: 0, bedwars: 0 };
  return {
    votes: { survival: votes.survival, bedwars: votes.bedwars },
    total: votes.survival + votes.bedwars,
    resetAt: (bucket + 1) * WINDOW_MS,
    secondsLeft: Math.max(0, Math.ceil(((bucket + 1) * WINDOW_MS - now) / 1000)),
  };
}

/** Adds one vote for `world`; returns null when the world is not one of ours. */
export function recordVote(world, now = Date.now()) {
  if (world !== "survival" && world !== "bedwars") return null;
  const bucket = bucketFor(now);
  const votes = buckets.get(bucket) || { survival: 0, bedwars: 0 };
  votes[world] += 1;
  buckets.set(bucket, votes);
  return snapshot(now);
}
