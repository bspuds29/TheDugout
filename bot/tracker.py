"""
Tracks which stat candidates have already been tweeted to prevent duplicates.
State is stored in a JSON file that gets committed back to the repo.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import config

log = logging.getLogger(__name__)


def _load() -> dict:
    try:
        return json.loads(config.USED_STATS_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {"used_ids": [], "tweet_log": []}


def _save(state: dict) -> None:
    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
    config.USED_STATS_FILE.write_text(json.dumps(state, indent=2))


def is_used(candidate_id: str) -> bool:
    return candidate_id in _load().get("used_ids", [])


def mark_used(candidate_id: str, tweet_text: str, tweet_id: str | None,
              player_name: str, stat_description: str) -> None:
    state = _load()
    if candidate_id not in state["used_ids"]:
        state["used_ids"].append(candidate_id)
    state.setdefault("tweet_log", []).append({
        "id":          candidate_id,
        "tweet_text":  tweet_text,
        "tweet_id":    tweet_id,
        "player":      player_name,
        "stat":        stat_description,
        "timestamp":   datetime.now(timezone.utc).isoformat(),
    })
    # Keep log to last 365 entries
    state["tweet_log"] = state["tweet_log"][-365:]
    state["last_run"]  = datetime.now(timezone.utc).isoformat()
    _save(state)
    log.info("Marked as used: %s", candidate_id)


def used_ids() -> set[str]:
    return set(_load().get("used_ids", []))


def last_tweet_type() -> str | None:
    """Return 'hitting' or 'pitching' based on the most recent tweet, or None."""
    log = _load().get("tweet_log", [])
    if not log:
        return None
    last_id = log[-1].get("id", "")
    if any(k in last_id for k in ("_hit_", "weekly_", "bat_hr", "bat_wrc", "bat_war", "team_")):
        return "hitting"
    if any(k in last_id for k in ("_pit_", "pit_era", "pit_kpct", "pit_war")):
        return "pitching"
    return None


def last_stat_type() -> str | None:
    """
    Return the granular stat_type of the most recent tweet
    (e.g. 'weekly_hitting', 'game_hitting', 'game_pitching', 'team_game').
    Used to prevent the same category from appearing back-to-back.
    """
    tweet_log = _load().get("tweet_log", [])
    if not tweet_log:
        return None
    last_id = tweet_log[-1].get("id", "")
    if "weekly_" in last_id:
        return "weekly_hitting"
    if "team_" in last_id or "streak_" in last_id:
        return "team_game"
    if "_hit_" in last_id:
        return "game_hitting"
    if "_pit_" in last_id:
        return "game_pitching"
    if "bat_" in last_id:
        return "season_batting"
    if "pit_era" in last_id or "pit_kpct" in last_id or "pit_war" in last_id:
        return "season_pitching"
    return None
