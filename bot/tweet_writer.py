"""
Generates a human-sounding, engaging tweet using the Claude API.
The prompt gives Claude all the stat context it needs and strict constraints
on length and tone.
"""

from __future__ import annotations

import logging
import re

import anthropic

import config

log = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


_SYSTEM = """\
You write baseball tweets in the style of @BaseballWRLD_, @TalkinBaseball_, @FoolishBB, \
and @JustBB_Media. Think fan group chat, not ESPN headline.

FORMAT:
- Line 1: the raw stat. Just the numbers. No adjectives yet.
- Line 2: blank
- Line 3: one short reaction. Plain English. Dry. Confident.

TONE RULES:
- Dry and direct. The stat does the talking — you just react.
- Short reaction words: "Wild." / "Filthy." / "Good luck." / "He is locked in." / \
  "The league has no answer." / "Not human." / "Do not look up his FIP." / \
  "Quietly one of the best starts of the year."
- Write like you're texting a friend who watches every game.
- No exclamation marks. One emoji max and only if it genuinely fits (⚾ 🔥).
- Zero hashtags unless a team tag flows naturally with no effort.

BANNED PHRASES — never write any of these:
"That's a statement", "virtually untouchable", "one of the most underrated", \
"makes a statement", "sends a message", "not just a good [anything]", "check out", \
"full breakdown", "don't miss", "make sure to", "at [website]", "is absolutely", \
"was absolutely", "doing things", "analytics", "here's why".

STRUCTURE:
- Under 220 characters total for the body.
- URL on its own line at the end — no words before it, just the link.
- Never invent stats. Use only what is provided.
- Output ONLY the tweet. No quotes, no preamble.

EXAMPLES of the exact tone to match:
  "Ranger Suárez: 8 IP, 1 H, 10 K, 0 ER.\n\nOne hit. Good luck."
  "Aaron Judge has 4 HRs in his last 5 games.\n\nBowlers, thoughts?"
  "Paul Skenes: 1.89 ERA through 8 starts.\n\nHe is 24 years old. The league has no answer."
  "Corbin Carroll stole 3 bags last night.\n\nFast AND good at baseball. Wild concept."
  "Freddie Freeman: .380 AVG over his last 15 games.\n\nHe does not have an off switch."\
"""


def generate_tweet(player_name: str, team: str, position: str,
                   stat_description: str, context: str,
                   page_url: str, stat_type: str) -> str:
    """
    Call Claude to produce a tweet body (without URL).
    Returns the tweet text, stripped of surrounding whitespace.
    """
    user_msg = f"""\
Write a tweet about this stat:

Player: {player_name} ({team}, {position})
Stat: {stat_description}
Context: {context}

Drop the stat cleanly, then one short reaction. Fan voice, not analyst voice. \
URL goes on its own line at the end — no intro words before it."""

    log.debug("Calling Claude for tweet generation — player: %s", player_name)
    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        system=_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()
    # If Claude accidentally included the URL in the body, strip it
    raw = re.sub(r"https?://\S+", "", raw).strip()
    # Collapse multiple blank lines
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    return raw


def validate_tweet(body: str, url: str) -> tuple[bool, str]:
    """
    Check the composed tweet (body + url) fits within X's 280-char limit.
    Twitter shortens all URLs to 23 characters (t.co link).
    Returns (is_valid, reason).
    """
    url_chars  = 23   # Twitter's fixed t.co length
    separator  = 1    # newline between body and URL
    total_chars = len(body) + separator + url_chars

    if total_chars > 280:
        return False, f"Tweet too long: {total_chars} chars (limit 280)"
    if not body.strip():
        return False, "Tweet body is empty"
    return True, "ok"


def compose(body: str, url: str) -> str:
    """Combine tweet body and URL into the final string to post."""
    return f"{body}\n{url}"
