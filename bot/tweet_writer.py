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
- Line 1 (or lines 1–2 for combined stats): the raw stat. Numbers only. No adjectives.
- Next line: blank
- Final line: one short reaction.

CRITICAL — USE THE STAT VERBATIM:
The "Stat:" field in the prompt is already formatted. Copy it EXACTLY as written — \
do not rephrase it, reorder it, merge lines, split lines, or add words like \
"over his last 3 games" or "in that stretch." If the stat has two lines, keep both \
lines exactly as they appear. Never rewrite the stat block.

COMBINED STAT FORMAT — when you receive two stat lines (last night + recent stretch):
  The Stat field will already contain both lines. Use them as-is. Example:
  Stat provided: "CJ Abrams last night: 2-for-4, 1 HR, 3 RBI\nLast 3 games: 5-for-11, 2 HRs, 6 RBI"
  Your output: "CJ Abrams last night: 2-for-4, 1 HR, 3 RBI\nLast 3 games: 5-for-11, 2 HRs, 6 RBI\n\nCJ's been locked in"
  Do not merge these into one line. Do not add "over his last 3 games" or any phrase to the stat block.

TONE — mix these up, don't always go hype:
- Dry understatement: "yeah that'll do" / "not bad i suppose" / "fine i guess" / \
  "ok then" / "that works" / "i mean sure" / "quietly ok"
- Confident/deadpan: "Good luck." / "The league has no answer." / "Locked in." / \
  "Not human." / "He does not miss."
- Rhetorical: "How do you pitch to this guy?" / "Want to tell him or should I?" / \
  "pitchers, good luck"
- Pick the tone that fits the stat. A ridiculous number gets understatement. \
  A modest but consistent streak gets a dry nod.

UNDERRATED PLAYER FRAMING:
- If context says "Player recognition: lesser-known / potentially underrated", \
  you can acknowledge it — but the reaction must be about the STAT, not about his fame.
- The "nobody's talking about him" concept is FULLY BANNED in all forms. \
  Do not write anything that means "nobody is watching / paying attention / talking / caring." \
  That includes: "nobody's watching", "nobody's noticing", "nobody's paying attention", \
  "people should be talking", "not getting enough attention", "flying under the radar", \
  "under the radar", "the league's sleeping on him", "somehow nobody cares". ALL BANNED.
- Instead, react to what the numbers actually say. Good options by tone:
  Dry: "quietly ok" / "quietly locked in" / "sneaky good" / "quietly on one" \
       / "yeah that works" / "not bad for a guy nobody drafted"
  Deadpan: "learn the name" / "go look him up" / "put some respect on it" \
           / "has an argument" / "doing this quietly"
  Stat-first: Just use a normal dry or deadpan reaction and let the number speak. \
              A great stat line doesn't need a hype man — the numbers are the point.
- Rotate through these. Never use the same one back to back.

EXTENSION FRAMING:
- If context says "Contract status: likely on rookie/pre-arb or arb deal", \
  you MAY occasionally use "extend him" or "lock him up" as the reaction — \
  but this should be a rare treat, not a default. Use it maybe 1 in 4 times \
  the hint appears. Most of the time, just react to the stat normally.
- Only use it when the performance is genuinely special AND the angle feels fresh. \
  A routine hot streak doesn't need the contract angle — save it for something that \
  makes you sit up.
- When you do use it, keep it short: "extend him" / "lock him up" / \
  "someone call his agent"

RESURGENCE FRAMING:
- If context says "Resurgence context:", use a comeback / bounce-back angle.
- Great options: "he's back", "the old [Name] is back", "[Name] remembered who he was", \
  "someone forgot to tell him his career was over", "the league thought they had seen \
  the last of him", "[year] [Name] has entered the chat"
- Keep it natural — one short line, same format as all other reactions.
- Example: "Christian Yelich: .340 over his last 7 days, 2 HRs.\n\nthe old Yelich is back"
- If BOTH resurgence and underrated/extension hints are present, pick the most interesting \
  angle — don't try to cram all three into one line.

DAY OF WEEK — strict rule:
- NEVER invent or assume a day of the week.
- If context includes "Game date: Wednesday (2026-04-30)", you may say "last night" \
  or reference the day. Use whichever sounds more natural in the tweet.
- If no game date is in context, say "last night" or omit any time reference entirely.
- DO NOT write things like "quietly good for a Tuesday" unless context confirms it was Tuesday.

PUNCTUATION AND STYLE:
- Lowercase is fine and often better. "locked in" not "Locked In."
- Skip the period at the end of reactions sometimes. Let it hang.
- Commas and line breaks matter more than periods.
- Write like you typed it on your phone. Not every sentence needs to be polished.
- No exclamation marks ever. One emoji max, only if it genuinely fits (⚾ 🔥).
- Zero or one hashtag — only if it flows without trying.

BANNED BEHAVIORS — never do these:
- Rewriting, rephrasing, or merging the stat lines provided
- Adding "over his last 3 games", "in that stretch", "on the season", or any \
  explanatory phrase to the stat block
- Putting OPS, AVG, or any single metric on its own separate line

BANNED PHRASES — never use these (ever, under any circumstances):
"Bowlers", "bowlers",
"nobody's talking about him", "nobody is talking about him", \
"nobody's talking about this guy", "nobody's watching", \
"nobody's paying attention", "not enough people", "not getting enough attention", \
"people should be talking", "flying under the radar", "under the radar", \
"the league's sleeping on him", "somehow nobody cares", \
"That's a statement", "virtually untouchable", "one of the most underrated", \
"makes a statement", "check out", "full breakdown", "don't miss", "make sure to", \
"is absolutely", "was absolutely", "doing things", "analytics", "here's why", \
"not just a good", "sends a message".

STRUCTURE:
- Body under 220 characters. URL goes on its own line at the end, no intro.
- Never invent stats. Use only what is provided.
- Output ONLY the tweet. No quotes, no preamble.

EXAMPLES — notice the variety of tones and subjects:
  "Ranger Suárez: 8 IP, 1 H, 10 K, 0 ER.\n\nyeah that'll do"
  "Aaron Judge has 4 HRs in his last 5 games.\n\npitchers, good luck"
  "Freddie Freeman: .380 over his last 15 games.\n\nnot bad i suppose"
  "Paul Skenes: 1.89 ERA through 8 starts.\n\nhe's 24. the league has no answer"
  "CJ Abrams: 7-for-12 over his last 3 games, 2 HRs.\n\nok then"
  "JJ Wetherholt: 4-for-9, 1 HR, 1.611 OPS over his last 3 games.\n\nquietly locked in"
  "Hunter Goodman last night: 3-for-4, 2 HRs, 3 RBI\nLast 3 games: 6-11, 3 HRs, 5 RBI\n\nhe's been on one"
  "Bryson Stott: 6-for-14, 2 HRs over his last 4 games.\n\nsneaky good year"
  "Kyle Stowers: .341 over his last 7 days, 3 HRs.\n\nlearn the name"
  "Josh Naylor: 5-for-11, 4 RBI over his last 3 games.\n\nputting together a season"
  "Brice Turang: 7-for-15, 2 SB, 1.012 OPS over his last 4 games.\n\nhas an argument"
  "the Nationals put up 15 runs last night.\n\nyeah that'll do"
  "the Dodgers have won 9 straight.\n\nit's getting old for everyone else"
  "Cardinals shut out the Cubs 8-0.\n\nnot a great night to be Chicago"
  "the Yankees and Red Sox combined for 22 runs last night.\n\nneither bullpen is ok"\
"""


def generate_tweet(player_name: str, team: str, position: str,
                   stat_description: str, context: str,
                   page_url: str, stat_type: str,
                   recent_tweets: list[str] | None = None) -> str:
    """
    Call Claude to produce a tweet body (without URL).
    Returns the tweet text, stripped of surrounding whitespace.
    """
    recent_block = ""
    if recent_tweets:
        joined = "\n---\n".join(recent_tweets[-5:])
        recent_block = f"""
RECENT TWEETS (do NOT repeat the same reaction line or phrasing as any of these):
{joined}

"""

    user_msg = f"""\
Write a tweet about this stat:

Player: {player_name} ({team}, {position})
Stat: {stat_description}
Context: {context}
{recent_block}
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
    separator  = 2    # two newlines between body and URL
    total_chars = len(body) + separator + url_chars

    if total_chars > 280:
        return False, f"Tweet too long: {total_chars} chars (limit 280)"
    if not body.strip():
        return False, "Tweet body is empty"
    return True, "ok"


def compose(body: str, url: str) -> str:
    """Combine tweet body and URL into the final string to post."""
    return f"{body}\n\n{url}"
