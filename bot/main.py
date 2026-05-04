"""
Daily baseball tweet bot — entry point.

Flow:
  1. Collect stat candidates (yesterday's games + season leaders)
  2. Filter out already-tweeted stats
  3. Pick the highest-scoring unused candidate
  4. Generate a tweet via Claude
  5. Fetch player headshot from MLB CDN
  6. Post to X/Twitter (with image if API tier allows)
  7. Persist state and log everything

Run with DRY_RUN=true to generate and print the tweet without posting.
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone

import config
import collector
import tweet_writer
import image_handler
import poster
import tracker


# ── Logging setup ─────────────────────────────────────────────────────

def _setup_logging() -> None:
    config.LOG_DIR.mkdir(parents=True, exist_ok=True)
    fmt = "%(asctime)s  %(levelname)-8s  %(name)s — %(message)s"
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    try:
        handlers.append(logging.FileHandler(config.LOG_FILE, encoding="utf-8"))
    except OSError:
        pass
    logging.basicConfig(level=logging.INFO, format=fmt, handlers=handlers)


log = logging.getLogger(__name__)


# ── Main ──────────────────────────────────────────────────────────────

def run() -> int:
    """
    Execute one bot cycle.  Returns 0 on success, 1 on error.
    """
    _setup_logging()
    log.info("=" * 60)
    log.info("TheDugout tweet bot starting — %s", datetime.now(timezone.utc).isoformat())
    log.info("Season: %d  |  Dry-run: %s", config.SEASON, config.DRY_RUN)

    # ── Validate env vars ──
    missing = config.validate()
    if missing:
        log.error("Missing required environment variables: %s", ", ".join(missing))
        return 1

    # ── Collect candidates ──
    log.info("Collecting stat candidates…")
    try:
        candidates = collector.collect_all(
            config.SEASON, config.LOOKBACK_DAYS,
            last_tweet_type=tracker.last_tweet_type(),
            last_stat_type=tracker.last_stat_type(),
        )
    except Exception as exc:
        log.error("Candidate collection failed: %s", exc, exc_info=True)
        return 1

    if not candidates:
        log.warning("No stat candidates found — nothing to tweet today.")
        return 0

    # ── Filter already-used stats ──
    used = tracker.used_ids()
    fresh = [c for c in candidates if c.candidate_id not in used]

    if not fresh:
        log.warning(
            "All %d candidates have already been tweeted. "
            "Consider increasing LOOKBACK_DAYS or waiting for new games.",
            len(candidates),
        )
        return 0

    log.info("%d fresh candidates after dedup (of %d total)", len(fresh), len(candidates))

    # ── Filter repeat players (same player tweeted recently) ──
    # Allow the repeat only for truly exceptional single-game performances:
    # no-hitter bids, 3+ HR games, or a cycle (1B+2B+3B+HR in one game).
    def _is_exceptional(c: collector.StatCandidate) -> bool:
        rs = c.raw_stats
        if c.stat_type in ("game_hitting", "combined_hitting"):
            hr = int(rs.get("homeRuns", 0))
            if hr >= 3:
                return True
            # Cycle check: at least one of each extra-base hit plus 4+ hits total
            if (int(rs.get("doubles", 0)) >= 1
                    and int(rs.get("triples", 0)) >= 1
                    and int(rs.get("homeRuns", 0)) >= 1
                    and int(rs.get("hits", 0)) >= 4):
                return True
        if c.stat_type == "game_pitching":
            hits = int(rs.get("hits", 0))
            ip   = collector._parse_ip(rs.get("inningsPitched", "0"))
            if hits == 0 and ip >= 5:
                return True
        return False

    recent_players = tracker.recently_tweeted_players(n_recent=10)
    deduped = [
        c for c in fresh
        if c.player_name.lower() not in recent_players or _is_exceptional(c)
    ]

    if not deduped:
        log.warning(
            "All %d fresh candidates belong to recently-tweeted players. "
            "Falling back to the full fresh list to avoid skipping a day.",
            len(fresh),
        )
        deduped = fresh

    log.info("%d candidates after player-repeat filter", len(deduped))

    # ── Pick best candidate ──
    best = deduped[0]
    log.info(
        "Selected candidate: '%s' — %s (score=%.1f, type=%s)",
        best.player_name, best.stat_description, best.score, best.stat_type,
    )

    # ── Generate tweet ──
    log.info("Generating tweet via Claude…")
    recent_bodies = tracker.recent_tweet_bodies(n_recent=5)
    try:
        tweet_body = tweet_writer.generate_tweet(
            player_name=best.player_name,
            team=best.team,
            position=best.position,
            stat_description=best.stat_description,
            context=best.context,
            page_url=best.page_url,
            stat_type=best.stat_type,
            recent_tweets=recent_bodies,
        )
    except Exception as exc:
        log.error("Tweet generation failed: %s", exc, exc_info=True)
        return 1

    full_tweet = tweet_writer.compose(tweet_body, best.page_url)
    valid, reason = tweet_writer.validate_tweet(tweet_body, best.page_url)

    log.info("─" * 50)
    log.info("TWEET PREVIEW:\n%s", full_tweet)
    log.info("Length: %d chars (body) + 23 (t.co URL) = %d total",
             len(tweet_body), len(tweet_body) + 1 + 23)
    log.info("─" * 50)

    if not valid:
        log.error("Tweet validation failed: %s", reason)
        # Attempt a shorter fallback — truncate body and re-validate
        tweet_body = tweet_body[:215].rsplit(" ", 1)[0] + "…"
        full_tweet = tweet_writer.compose(tweet_body, best.page_url)
        valid, reason = tweet_writer.validate_tweet(tweet_body, best.page_url)
        if not valid:
            log.error("Truncated tweet still invalid: %s — aborting.", reason)
            return 1
        log.warning("Using truncated tweet body.")

    # ── Fetch player image ──
    image_bytes: bytes | None = None
    if config.INCLUDE_IMAGE and best.mlb_id:
        log.info("Fetching headshot for mlbId=%d…", best.mlb_id)
        try:
            image_bytes = image_handler.fetch_headshot(best.mlb_id)
        except Exception as exc:
            log.warning("Headshot fetch error: %s — will post without image.", exc)
    elif not config.INCLUDE_IMAGE:
        log.info("Image upload disabled (INCLUDE_IMAGE=false)")

    # ── Dry-run exit ──
    if config.DRY_RUN:
        log.info("DRY RUN — tweet not posted.")
        log.info("Would post:\n%s", full_tweet)
        log.info("Image available: %s", image_bytes is not None)
        tracker.mark_used(
            best.candidate_id, full_tweet, tweet_id="dry-run",
            player_name=best.player_name, stat_description=best.stat_description,
        )
        return 0

    # ── Post tweet ──
    log.info("Posting tweet…")
    try:
        tweet_id = poster.post_tweet(full_tweet, image_bytes)
    except Exception as exc:
        log.error("Tweet posting failed: %s", exc, exc_info=True)
        return 1

    # ── Persist state ──
    tracker.mark_used(
        best.candidate_id, full_tweet, tweet_id=tweet_id,
        player_name=best.player_name, stat_description=best.stat_description,
    )

    log.info("Done. Tweet ID: %s", tweet_id)
    return 0


if __name__ == "__main__":
    sys.exit(run())
