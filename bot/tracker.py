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
