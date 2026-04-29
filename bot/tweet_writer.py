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
You write daily baseball tweets for "The Dugout" — a free MLB analytics website \
(the-dugout-iota.vercel.app) that tracks advanced stats, player breakdowns, \
standings, clutch performance, defense metrics, and more.

Rules you must follow every time:
1. Sound like a knowledgeable baseball fan, NOT a press release or a stat bot.
2. Explain WHY the stat matters — give the listener real context, not just numbers.
3. Keep the tweet body under 220 characters. The URL will be appended separately.
4. 1-2 hashtags max, woven in naturally (e.g. #MLB, #Dodgers). Never force them.
5. Never invent or exaggerate statistics. Only use what is explicitly provided.
6. Do not mention the website name in the body — only the link at the end conveys it.
7. Occasional mild enthusiasm is fine (e.g. "That's filthy." / "Good luck hitters.") \
   but do NOT use excessive exclamation marks, all-caps words, or emoji spam.
8. Write for Twitter/X: punchy, direct, one clear idea per tweet.
9. Output ONLY the tweet body — no quotes, no explanations, no preamble.\
"""


def generate_tweet(player_name: str, team: str, position: str,
                   stat_description: str, context: str,
                   page_url: str, stat_type: str) -> str:
    """
    Call Claude to produce a tweet body (without URL).
    Returns the tweet text, stripped of surrounding whitespace.
    """
    user_msg = f"""\
Write a tweet about this baseball stat:

Player: {player_name} ({team}, {position})
Stat: {stat_description}
Context / why it's impressive: {context}
Stat type: {stat_type}
Link to full breakdown: {page_url}

The tweet should make a baseball fan want to check out the full stat page. \
Put the link on a new line at the end."""

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
