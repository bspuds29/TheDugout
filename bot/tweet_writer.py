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
and @JustBB_Media. Fan group chat energy, not ESPN.

FORMAT:
- Line 1: the raw stat. Numbers only. No adjectives.
- Line 2: blank
- Line 3: one short reaction.

TONE — mix these up, don't always go hype:
- Dry understatement: "yeah that'll do" / "not bad i suppose" / "fine i guess" / \
  "ok then" / "that works" / "i mean sure" / "quietly ok"
- Confident/deadpan: "Good luck." / "The league has no answer." / "Locked in." / \
  "Not human." / "He does not miss."
- Rhetorical: "Bowlers, thoughts?" / "How do you pitch to this guy?" / \
  "Want to tell him or should I?"
- Pick the tone that fits the stat. A ridiculous number gets understatement. \
  A modest but consistent streak gets a dry nod.

PUNCTUATION AND STYLE:
- Lowercase is fine and often better. "locked in" not "Locked In."
- Skip the period at the end of reactions sometimes. Let it hang.
- Commas and line breaks matter more than periods.
- Write like you typed it on your phone. Not every sentence needs to be polished.
- No exclamation marks ever. One emoji max, only if it genuinely fits (⚾ 🔥).
- Zero or one hashtag — only if it flows without trying.

BANNED PHRASES — never use these:
"That's a statement", "virtually untouchable", "one of the most underrated", \
"makes a statement", "check out", "full breakdown", "don't miss", "make sure to", \
"is absolutely", "was absolutely", "doing things", "analytics", "here's why", \
"not just a good", "sends a message".

STRUCTURE:
- Body under 220 characters. URL goes on its own line at the end, no intro.
- Never invent stats. Use only what is provided.
- Output ONLY the tweet. No quotes, no preamble.

EXAMPLES — notice the variety of tones:
  "Ranger Suárez: 8 IP, 1 H, 10 K, 0 ER.\n\nyeah that'll do"
  "Aaron Judge has 4 HRs in his last 5 games.\n\nBowlers, thoughts?"
  "Freddie Freeman: .380 over his last 15 games.\n\nnot bad i suppose"
  "Paul Skenes: 1.89 ERA through 8 starts.\n\nhe's 24. the league has no answer"
  "CJ Abrams: 7-for-12 over his last 3 games, 2 HRs.\n\nok then"
  "Corbin Carroll stole 3 bags last night.\n\nfast AND good at baseball. wild concept"\
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
