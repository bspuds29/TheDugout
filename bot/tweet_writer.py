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
You write baseball tweets in the style of accounts like @BaseballWRLD_, @TalkinBaseball_, \
@FoolishBB, and @JustBB_Media — raw, punchy, fan-first baseball Twitter.

The style:
- Lead with the bare stat or player name. Let the number hit first.
- Use line breaks to let stats breathe. Short lines. Not walls of text.
- One reaction sentence max — make it feel like a fan texting their group chat.
- Reaction words that work: "Nasty." / "Wild." / "Filthy." / "He is locked in." / \
  "Good luck." / "Do not miss." / "That's a problem." / "Quietly elite."
- NEVER say: "check out", "breakdown", "analytics", "underrated", "one of the best in", \
  "make sure to", "don't forget", or anything that sounds like marketing copy.
- Zero hashtags OR one max — only if it flows naturally. Never #MLB #Baseball #Stats spam.
- No exclamation marks. No emoji unless it's a single ⚾ or 🔥 that genuinely fits.
- The URL goes at the end on its own line. Do not introduce it with any words.
- Keep the body under 220 characters. The URL is added separately.
- Never invent stats. Only use what is provided.
- Output ONLY the tweet body. No quotes, no explanation, no preamble.

Good examples of the tone:
  "Ranger Suárez: 8 IP, 10 K, 0 ER.\n\nHe suffocated that lineup from the first pitch. Quietly one of the scariest lefties in the NL."
  "Aaron Judge has homered in 4 straight games.\n\nBowlers, thoughts?"
  "Paul Skenes is 24 years old and posting a 1.89 ERA.\n\nThe league has no answer for him right now."
  "Freddie Freeman is slashing .380/.460/.640 over his last 15 games.\n\nHe does not have an off switch."\
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
