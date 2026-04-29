"""
Central configuration — all env vars loaded here, nothing else imports os.environ directly.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Paths ──────────────────────────────────────────────────────────────
BOT_DIR   = Path(__file__).parent
STATE_DIR = BOT_DIR / "state"
LOG_DIR   = BOT_DIR / "logs"
USED_STATS_FILE = STATE_DIR / "used_stats.json"
LOG_FILE        = LOG_DIR  / "bot.log"

# ── Twitter / X API credentials ────────────────────────────────────────
TWITTER_API_KEY        = os.getenv("TWITTER_API_KEY", "")
TWITTER_API_SECRET     = os.getenv("TWITTER_API_SECRET", "")
TWITTER_ACCESS_TOKEN   = os.getenv("TWITTER_ACCESS_TOKEN", "")
TWITTER_ACCESS_SECRET  = os.getenv("TWITTER_ACCESS_SECRET", "")
TWITTER_BEARER_TOKEN   = os.getenv("TWITTER_BEARER_TOKEN", "")

# ── Anthropic API ──────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Bot behaviour ──────────────────────────────────────────────────────
DRY_RUN      = os.getenv("DRY_RUN",      "false").lower() in ("true", "1", "yes")
INCLUDE_IMAGE = os.getenv("INCLUDE_IMAGE", "true").lower()  in ("true", "1", "yes")
SEASON  = int(os.getenv("MLB_SEASON", "2026"))

# How many days back to look for game data (1 = yesterday only)
LOOKBACK_DAYS = int(os.getenv("LOOKBACK_DAYS", "1"))

# ── Website ────────────────────────────────────────────────────────────
SITE_URL = "https://thedugoutapi.com"

def validate() -> list[str]:
    """Return a list of missing required env var names."""
    required = {
        "TWITTER_API_KEY":       TWITTER_API_KEY,
        "TWITTER_API_SECRET":    TWITTER_API_SECRET,
        "TWITTER_ACCESS_TOKEN":  TWITTER_ACCESS_TOKEN,
        "TWITTER_ACCESS_SECRET": TWITTER_ACCESS_SECRET,
        "ANTHROPIC_API_KEY":     ANTHROPIC_API_KEY,
    }
    return [k for k, v in required.items() if not v]
