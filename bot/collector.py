"""
Data collection: pulls yesterday's game standouts and current season leaders
from the MLB Stats API and FanGraphs API (same sources the website uses).
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import requests

import config

log = logging.getLogger(__name__)

MLB_API = "https://statsapi.mlb.com/api/v1"
FG_API  = "https://www.fangraphs.com/api/leaders/major-league/data"

# Players that are genuine household names — anyone NOT in this set
# and playing well can be flagged as "underrated / flying under the radar".
_HOUSEHOLD_NAMES: frozenset[str] = frozenset({
    "aaron judge", "shohei ohtani", "mike trout", "freddie freeman",
    "mookie betts", "fernando tatis jr.", "juan soto", "vladimir guerrero jr.",
    "bryce harper", "ronald acuna jr.", "paul skenes", "spencer strider",
    "francisco lindor", "pete alonso", "jose ramirez", "yordan alvarez",
    "corey seager", "trea turner", "gunnar henderson", "julio rodriguez",
    "nolan arenado", "corbin carroll", "elly de la cruz", "bobby witt jr.",
    "adley rutschman", "max fried", "zack wheeler", "gerrit cole",
    "clayton kershaw", "dylan cease",
})

_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": "TheDugoutBot/1.0 (baseball analytics fan site)",
    "Accept": "application/json",
})


# ── Data model ────────────────────────────────────────────────────────

@dataclass
class StatCandidate:
    candidate_id:     str
    player_name:      str
    mlb_id:           int
    team:             str
    team_abbrev:      str
    position:         str
    stat_type:        str   # game_hitting | game_pitching | season_batting | season_pitching
    stat_description: str
    context:          str   # why it's impressive (fed to Claude)
    page_url:         str
    score:            float
    raw_stats:        dict  = field(default_factory=dict)
    date:             str   = ""

    def player_page_url(self) -> str:
        params = urlencode({"mlbId": self.mlb_id, "name": self.player_name})
        return f"{config.SITE_URL}/player?{params}"


# ── HTTP helpers ──────────────────────────────────────────────────────

def _get(url: str, params: dict | None = None, retries: int = 3) -> dict | list:
    for attempt in range(retries):
        try:
            r = _SESSION.get(url, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as exc:
            if attempt == retries - 1:
                raise
            log.warning("Request failed (attempt %d/%d): %s — %s", attempt + 1, retries, url, exc)
            time.sleep(2 ** attempt)


# ── Date helpers ──────────────────────────────────────────────────────

def _et_date(days_back: int = 1) -> str:
    """Return a date string (YYYY-MM-DD) in approximate Eastern Time."""
    et_offset = timedelta(hours=-4)  # EDT; close enough year-round for this use case
    dt = datetime.now(timezone.utc) + et_offset - timedelta(days=days_back)
    return dt.strftime("%Y-%m-%d")


def _day_name(date_str: str) -> str:
    """Return the day-of-week name from a YYYY-MM-DD string, e.g. 'Wednesday'."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
    except ValueError:
        return ""


def _recognition(player_name: str) -> str:
    """Return a player-recognition hint for Claude based on name fame."""
    if player_name.lower() in _HOUSEHOLD_NAMES:
        return "star / widely known"
    return "lesser-known / potentially underrated"


# ── MLB Stats API helpers ─────────────────────────────────────────────

def _mlb(endpoint: str, **params) -> dict:
    return _get(f"{MLB_API}{endpoint}", params=params or None)


def _fetch_schedule(date_str: str) -> list[dict]:
    data = _mlb("/schedule", sportId=1, date=date_str, hydrate="team,linescore")
    games = []
    for date_entry in data.get("dates", []):
        games.extend(date_entry.get("games", []))
    return games


def _fetch_boxscore(game_pk: int) -> dict:
    return _mlb(f"/game/{game_pk}/boxscore")


def _parse_ip(ip_str: str) -> float:
    """Convert '7.1' (7 and 1/3 IP) to a float."""
    try:
        whole, frac = str(ip_str).split(".")
        return int(whole) + int(frac) / 3
    except (ValueError, AttributeError):
        return float(ip_str or 0)


# ── Game performance extraction ───────────────────────────────────────

def _score_hitting(s: dict) -> float:
    hr   = int(s.get("homeRuns", 0))
    hits = int(s.get("hits", 0))
    rbi  = int(s.get("rbi", 0))
    tb   = int(s.get("totalBases", 0))
    sb   = int(s.get("stolenBases", 0))
    ab   = int(s.get("atBats", 0))

    score  = hr  * 9.0
    score += rbi * 2.0
    score += max(0, hits - 2) * 3.0
    score += max(0, tb - 3)   * 1.2
    score += sb  * 3.0

    if hr >= 2:  score += 12.0
    if hr >= 3:  score += 18.0
    if hits >= 4: score += 7.0
    if ab >= 3 and hits == ab: score += 4.0  # perfect game bonus (3-for-3 etc.)
    return score


def _score_pitching(s: dict) -> float:
    k  = int(s.get("strikeOuts", 0))
    ip = _parse_ip(s.get("inningsPitched", "0"))
    er = int(s.get("earnedRuns", 0))
    h  = int(s.get("hits", 0))

    # Scaled down vs hitting so pitchers don't always dominate
    score  = k  * 1.2
    score += ip * 0.4
    if er == 0 and ip >= 6: score += 7.0
    if er == 0 and ip >= 8: score += 5.0
    if ip >= 8:             score += 4.0
    if h == 0 and ip >= 5:  score += 18.0  # no-hit bid is still very special
    if k >= 10:             score += 4.0
    if k >= 12:             score += 4.0
    return score


def _build_hitting_description(name: str, s: dict) -> tuple[str, str]:
    """Return (stat_description, context)."""
    hr   = int(s.get("homeRuns", 0))
    hits = int(s.get("hits", 0))
    rbi  = int(s.get("rbi", 0))
    tb   = int(s.get("totalBases", 0))
    ab   = int(s.get("atBats", 0))
    sb   = int(s.get("stolenBases", 0))
    avg_str = f"{hits}/{ab}" if ab else "0/0"

    parts = []
    if hr >= 2:      parts.append(f"{hr} HRs")
    elif hr == 1:    parts.append("a HR")
    if hits >= 3:    parts.append(f"{hits}-for-{ab}")
    elif not hr:     parts.append(f"{hits}-for-{ab}")
    if rbi >= 3:     parts.append(f"{rbi} RBI")
    if tb >= 8:      parts.append(f"{tb} total bases")
    if sb:           parts.append(f"{sb} SB")

    desc    = f"{name} went {avg_str} with {', '.join(parts) or 'a solid performance'}"
    context = f"Batting line: {hits}-{ab}, {hr} HR, {rbi} RBI, {tb} total bases, {sb} SB"
    return desc, context


def _build_pitching_description(name: str, s: dict) -> tuple[str, str]:
    ip = _parse_ip(s.get("inningsPitched", "0"))
    k  = int(s.get("strikeOuts", 0))
    er = int(s.get("earnedRuns", 0))
    h  = int(s.get("hits", 0))
    bb = int(s.get("baseOnBalls", 0))

    ip_display = s.get("inningsPitched", "0")
    shutout = er == 0 and ip >= 6
    no_hit  = h == 0 and ip >= 5

    if no_hit:
        desc    = f"{name} threw {ip_display} IP with no hits allowed, {k} Ks"
        context = f"No-hit performance through {ip_display} IP — {k} K, {bb} BB, {er} ER"
    elif shutout:
        desc    = f"{name} tossed {ip_display} scoreless innings with {k} Ks"
        context = f"Shutout outing: {ip_display} IP, {h} H, {k} K, {bb} BB, 0 ER"
    else:
        desc    = f"{name} went {ip_display} IP, {k} Ks, {er} ER"
        context = f"Start line: {ip_display} IP, {h} H, {k} K, {bb} BB, {er} ER"

    return desc, context


def collect_game_standouts(lookback_days: int = 1) -> list[StatCandidate]:
    """Collect top game performers from the past N days."""
    candidates: list[StatCandidate] = []

    for day in range(1, lookback_days + 1):
        date_str = _et_date(day)
        log.info("Fetching schedule for %s", date_str)

        try:
            games = _fetch_schedule(date_str)
        except Exception as exc:
            log.error("Failed to fetch schedule for %s: %s", date_str, exc)
            continue

        for game in games:
            status = game.get("status", {}).get("detailedState", "")
            if "Final" not in status:
                continue

            game_pk = game["gamePk"]
            log.debug("Processing game %d", game_pk)

            try:
                boxscore = _fetch_boxscore(game_pk)
            except Exception as exc:
                log.warning("Failed to fetch boxscore %d: %s", game_pk, exc)
                continue

            for side in ("home", "away"):
                team_data = boxscore.get("teams", {}).get(side, {})
                team_info = team_data.get("team", {})
                team_name = team_info.get("name", "Unknown")
                team_abbr = team_info.get("abbreviation", "")

                players = team_data.get("players", {})
                hit_candidates: list[tuple[float, dict, dict]] = []
                pit_candidates: list[tuple[float, dict, dict]] = []

                for player_key, player_data in players.items():
                    person   = player_data.get("person", {})
                    mlb_id   = person.get("id", 0)
                    name     = person.get("fullName", "Unknown")
                    pos_abbr = player_data.get("position", {}).get("abbreviation", "")
                    stats    = player_data.get("stats", {})

                    hitting_stats  = stats.get("batting", {})
                    pitching_stats = stats.get("pitching", {})

                    if hitting_stats and int(hitting_stats.get("atBats", 0)) >= 2:
                        s = _score_hitting(hitting_stats)
                        if s > 4:
                            hit_candidates.append((s, person, {"stats": hitting_stats, "pos": pos_abbr, "team": team_name, "team_abbr": team_abbr}))

                    if pitching_stats and _parse_ip(pitching_stats.get("inningsPitched", "0")) >= 4:
                        s = _score_pitching(pitching_stats)
                        if s > 6:
                            pit_candidates.append((s, person, {"stats": pitching_stats, "pos": pos_abbr, "team": team_name, "team_abbr": team_abbr}))

                # Keep top 2 hitters and top 1 pitcher per team per game
                # Use mlb_id as tiebreaker so sort is always stable
                game_day = _day_name(date_str)

                for score, person, meta in sorted(hit_candidates, key=lambda x: (x[0], x[1]["id"]), reverse=True)[:2]:
                    mlb_id = person["id"]
                    name   = person["fullName"]
                    desc, ctx = _build_hitting_description(name, meta["stats"])
                    ctx = f"Game date: {game_day} ({date_str}). Player recognition: {_recognition(name)}. {ctx}"
                    candidates.append(StatCandidate(
                        candidate_id=f"game_{game_pk}_hit_{mlb_id}",
                        player_name=name,
                        mlb_id=mlb_id,
                        team=meta["team"],
                        team_abbrev=meta["team_abbr"],
                        position=meta["pos"],
                        stat_type="game_hitting",
                        stat_description=desc,
                        context=ctx,
                        page_url=f"{config.SITE_URL}/player?mlbId={mlb_id}&name={name.replace(' ', '+')}",
                        score=score,
                        raw_stats=meta["stats"],
                        date=date_str,
                    ))

                for score, person, meta in sorted(pit_candidates, key=lambda x: (x[0], x[1]["id"]), reverse=True)[:1]:
                    mlb_id = person["id"]
                    name   = person["fullName"]
                    desc, ctx = _build_pitching_description(name, meta["stats"])
                    ctx = f"Game date: {game_day} ({date_str}). Player recognition: {_recognition(name)}. {ctx}"
                    candidates.append(StatCandidate(
                        candidate_id=f"game_{game_pk}_pit_{mlb_id}",
                        player_name=name,
                        mlb_id=mlb_id,
                        team=meta["team"],
                        team_abbrev=meta["team_abbr"],
                        position=meta["pos"],
                        stat_type="game_pitching",
                        stat_description=desc,
                        context=ctx,
                        page_url=f"{config.SITE_URL}/player?mlbId={mlb_id}&name={name.replace(' ', '+')}",
                        score=score,
                        raw_stats=meta["stats"],
                        date=date_str,
                    ))

    log.info("Collected %d game candidates", len(candidates))
    return candidates


# ── Season leaders ────────────────────────────────────────────────────

def _fg_batting(season: int) -> list[dict]:
    params = {
        "pos": "all", "stats": "bat", "lg": "all", "qual": "y",
        "season": season, "season1": season,
        "startdate": "", "enddate": "", "month": 0, "hand": "", "team": 0,
        "pageitems": 500, "pagenum": 1, "ind": 0, "rost": 0, "players": 0,
        "type": 8, "sortdir": "default", "sortstat": "WAR",
    }
    data = _get(FG_API, params)
    rows = data.get("data", data) if isinstance(data, dict) else data
    return [r for r in rows if r.get("xMLBAMID")]


def _fg_pitching(season: int) -> list[dict]:
    params = {
        "pos": "all", "stats": "pit", "lg": "all", "qual": "y",
        "season": season, "season1": season,
        "startdate": "", "enddate": "", "month": 0, "hand": "", "team": 0,
        "pageitems": 500, "pagenum": 1, "ind": 0, "rost": 0, "players": 0,
        "type": 8, "sortdir": "default", "sortstat": "WAR",
    }
    data = _get(FG_API, params)
    rows = data.get("data", data) if isinstance(data, dict) else data
    return [r for r in rows if r.get("xMLBAMID")]


def _is_multi_team(row: dict) -> bool:
    t = str(row.get("TeamNameAbb") or row.get("TeamName") or "").strip()
    return t.startswith(tuple("0123456789")) or t.startswith("-") or not t


def _milestone_bonus(value: float, step: int = 5) -> float:
    """Small bonus for being within 1 of a round milestone."""
    rem = value % step
    return 2.0 if rem <= 1 or rem >= step - 1 else 0.0


def collect_season_leaders(season: int) -> list[StatCandidate]:
    """Pull season leaders from FanGraphs and build tweet candidates."""
    candidates: list[StatCandidate] = []
    today = _et_date(0)

    # ── Batting leaders ──
    try:
        bat_rows = [r for r in _fg_batting(season) if not _is_multi_team(r)]
        log.info("FanGraphs batting leaderboard: %d rows", len(bat_rows))
    except Exception as exc:
        log.warning("FanGraphs batting fetch failed: %s", exc)
        bat_rows = []

    def _num(r: dict, key: str, decimals: int = 1) -> float:
        v = r.get(key)
        if v is None or v == "":
            return 0.0
        return round(float(v), decimals)

    def _pct(r: dict, key: str) -> float:
        n = _num(r, key, 4)
        return round(n * 100, 1) if n < 1.5 else round(n, 1)

    # HR leaders
    by_hr = sorted(bat_rows, key=lambda r: _num(r, "HR", 0), reverse=True)[:5]
    for rank, row in enumerate(by_hr, 1):
        mlb_id = int(row["xMLBAMID"])
        name   = str(row.get("PlayerName", ""))
        team   = str(row.get("TeamNameAbb") or row.get("TeamName") or "")
        pos    = str(row.get("positionDB") or row.get("Pos") or "")
        hr     = int(_num(row, "HR", 0))
        avg    = _num(row, "AVG", 3)
        ops    = _num(row, "OPS", 3)
        wrc    = int(_num(row, "wRC+", 0))
        score  = (6 - rank) * 3.0 + _milestone_bonus(hr, 5) + (wrc - 100) * 0.05

        candidates.append(StatCandidate(
            candidate_id=f"season_{season}_bat_hr_{mlb_id}",
            player_name=name,
            mlb_id=mlb_id,
            team=team,
            team_abbrev=team,
            position=pos,
            stat_type="season_batting",
            stat_description=f"{name} leads with {hr} HRs this season (slash: .{str(avg).split('.')[1] if '.' in str(avg) else avg})",
            context=f"Season stats: {hr} HR, AVG {avg:.3f}, OPS {ops:.3f}, wRC+ {wrc}. Rank #{rank} in MLB HR.",
            page_url=f"{config.SITE_URL}/leaderboard",
            score=score,
            raw_stats=dict(row),
            date=today,
        ))

    # wRC+ leaders (hitting quality)
    by_wrc = sorted(bat_rows, key=lambda r: _num(r, "wRC+", 0), reverse=True)[:5]
    for rank, row in enumerate(by_wrc, 1):
        mlb_id = int(row["xMLBAMID"])
        name   = str(row.get("PlayerName", ""))
        team   = str(row.get("TeamNameAbb") or row.get("TeamName") or "")
        pos    = str(row.get("positionDB") or row.get("Pos") or "")
        wrc    = int(_num(row, "wRC+", 0))
        war    = _num(row, "WAR", 1)
        woba   = _num(row, "wOBA", 3)
        ops    = _num(row, "OPS", 3)
        score  = (6 - rank) * 2.5 + (wrc - 130) * 0.08 if wrc > 130 else (6 - rank) * 2.5

        candidates.append(StatCandidate(
            candidate_id=f"season_{season}_bat_wrc_{mlb_id}",
            player_name=name,
            mlb_id=mlb_id,
            team=team,
            team_abbrev=team,
            position=pos,
            stat_type="season_batting",
            stat_description=f"{name} is posting a {wrc} wRC+, one of the best in baseball",
            context=f"Season stats: wRC+ {wrc} (100 = avg), wOBA {woba:.3f}, OPS {ops:.3f}, WAR {war}. wRC+ measures total offensive value vs league average.",
            page_url=f"{config.SITE_URL}/leaderboard",
            score=score,
            raw_stats=dict(row),
            date=today,
        ))

    # WAR leaders
    by_war = sorted(bat_rows, key=lambda r: _num(r, "WAR", 1), reverse=True)[:5]
    for rank, row in enumerate(by_war, 1):
        mlb_id = int(row["xMLBAMID"])
        name   = str(row.get("PlayerName", ""))
        team   = str(row.get("TeamNameAbb") or row.get("TeamName") or "")
        pos    = str(row.get("positionDB") or row.get("Pos") or "")
        war    = _num(row, "WAR", 1)
        hr     = int(_num(row, "HR", 0))
        avg    = _num(row, "AVG", 3)
        score  = (6 - rank) * 2.0 + _milestone_bonus(war, 1)

        candidates.append(StatCandidate(
            candidate_id=f"season_{season}_bat_war_{mlb_id}",
            player_name=name,
            mlb_id=mlb_id,
            team=team,
            team_abbrev=team,
            position=pos,
            stat_type="season_batting",
            stat_description=f"{name} leads position players with {war} WAR this season",
            context=f"Season stats: {war} WAR, {hr} HR, AVG {avg:.3f}. WAR = Wins Above Replacement, a comprehensive player value metric.",
            page_url=f"{config.SITE_URL}/leaderboard",
            score=score,
            raw_stats=dict(row),
            date=today,
        ))

    # ── Pitching leaders ──
    try:
        pit_rows = [r for r in _fg_pitching(season) if not _is_multi_team(r)]
        log.info("FanGraphs pitching leaderboard: %d rows", len(pit_rows))
    except Exception as exc:
        log.warning("FanGraphs pitching fetch failed: %s", exc)
        pit_rows = []

    # ERA leaders (min appearances already filtered by qual=y)
    by_era = sorted(pit_rows, key=lambda r: _num(r, "ERA", 2))[:5]
    for rank, row in enumerate(by_era, 1):
        mlb_id = int(row["xMLBAMID"])
        name   = str(row.get("PlayerName", ""))
        team   = str(row.get("TeamNameAbb") or row.get("TeamName") or "")
        gs     = int(_num(row, "GS", 0))
        pos    = "SP" if gs > 0 and gs / max(int(_num(row, "G", 0)), 1) >= 0.5 else "RP"
        era    = _num(row, "ERA", 2)
        fip    = _num(row, "FIP", 2)
        k_pct  = _pct(row, "K%")
        ip     = _num(row, "IP", 1)
        war    = _num(row, "WAR", 1)
        score  = (6 - rank) * 3.0 + max(0, 3.5 - era) * 2

        candidates.append(StatCandidate(
            candidate_id=f"season_{season}_pit_era_{mlb_id}",
            player_name=name,
            mlb_id=mlb_id,
            team=team,
            team_abbrev=team,
            position=pos,
            stat_type="season_pitching",
            stat_description=f"{name} owns a {era} ERA — one of the best qualified starters in baseball",
            context=f"Season stats: ERA {era}, FIP {fip}, K% {k_pct}%, {ip} IP, {war} WAR. Rank #{rank} in MLB ERA.",
            page_url=f"{config.SITE_URL}/leaderboard",
            score=score,
            raw_stats=dict(row),
            date=today,
        ))

    # K% leaders
    by_kpct = sorted(pit_rows, key=lambda r: _pct(r, "K%"), reverse=True)[:5]
    for rank, row in enumerate(by_kpct, 1):
        mlb_id = int(row["xMLBAMID"])
        name   = str(row.get("PlayerName", ""))
        team   = str(row.get("TeamNameAbb") or row.get("TeamName") or "")
        gs     = int(_num(row, "GS", 0))
        pos    = "SP" if gs > 0 and gs / max(int(_num(row, "G", 0)), 1) >= 0.5 else "RP"
        k_pct  = _pct(row, "K%")
        era    = _num(row, "ERA", 2)
        ip     = _num(row, "IP", 1)
        k9     = _num(row, "K/9", 1)
        score  = (6 - rank) * 2.5 + max(0, k_pct - 28) * 0.3

        candidates.append(StatCandidate(
            candidate_id=f"season_{season}_pit_kpct_{mlb_id}",
            player_name=name,
            mlb_id=mlb_id,
            team=team,
            team_abbrev=team,
            position=pos,
            stat_type="season_pitching",
            stat_description=f"{name} is striking out {k_pct}% of batters — elite stuff",
            context=f"Season stats: K% {k_pct}%, K/9 {k9}, ERA {era}, {ip} IP. League avg K% is ~22%; elite is 30%+.",
            page_url=f"{config.SITE_URL}/leaderboard",
            score=score,
            raw_stats=dict(row),
            date=today,
        ))

    # Pitching WAR leaders
    by_pwar = sorted(pit_rows, key=lambda r: _num(r, "WAR", 1), reverse=True)[:5]
    for rank, row in enumerate(by_pwar, 1):
        mlb_id = int(row["xMLBAMID"])
        name   = str(row.get("PlayerName", ""))
        team   = str(row.get("TeamNameAbb") or row.get("TeamName") or "")
        gs     = int(_num(row, "GS", 0))
        pos    = "SP" if gs > 0 and gs / max(int(_num(row, "G", 0)), 1) >= 0.5 else "RP"
        war    = _num(row, "WAR", 1)
        era    = _num(row, "ERA", 2)
        fip    = _num(row, "FIP", 2)
        ip     = _num(row, "IP", 1)
        score  = (6 - rank) * 2.0 + _milestone_bonus(war, 1)

        candidates.append(StatCandidate(
            candidate_id=f"season_{season}_pit_war_{mlb_id}",
            player_name=name,
            mlb_id=mlb_id,
            team=team,
            team_abbrev=team,
            position=pos,
            stat_type="season_pitching",
            stat_description=f"{name} leads pitchers with {war} WAR through early {season}",
            context=f"Season stats: {war} WAR, ERA {era}, FIP {fip}, {ip} IP.",
            page_url=f"{config.SITE_URL}/leaderboard",
            score=score,
            raw_stats=dict(row),
            date=today,
        ))

    log.info("Collected %d season leader candidates", len(candidates))
    return candidates


def _fetch_recent_splits(mlb_id: int, season: int) -> tuple[dict | None, dict | None]:
    """
    Fetch both last-7-days and last-14-days hitting splits in one API call.
    Returns (l7_stat, l14_stat) — either may be None.
    The MLB API doesn't have a native l3, so we use l7 as "recent" and
    derive the "last ~3 games" picture from the game log if l7 PA is small.
    """
    try:
        data = _mlb(
            f"/people/{mlb_id}/stats",
            stats="statSplits", group="hitting",
            season=season, sitCodes="l7,l14", sportId=1,
        )
        l7 = l14 = None
        for group in data.get("stats", []):
            if group.get("type", {}).get("displayName") == "statSplits":
                for split in group.get("splits", []):
                    code = split.get("split", {}).get("code")
                    if code == "l7":
                        l7 = split.get("stat")
                    elif code == "l14":
                        l14 = split.get("stat")
        return l7, l14
    except Exception:
        return None, None


def _compute_last_n_games(mlb_id: int, season: int, n: int = 3) -> dict | None:
    """
    Compute a hitting stat line for the player's last N games using their game log.
    Returns a synthetic stat dict with the same keys as a split stat, or None.
    """
    try:
        data = _mlb(
            f"/people/{mlb_id}/stats",
            stats="gameLog", group="hitting", season=season, sportId=1,
        )
        for group in data.get("stats", []):
            if group.get("type", {}).get("displayName") == "gameLog":
                splits = group.get("splits", [])
                recent = splits[-n:]  # last N entries (most recent games)
                if not recent:
                    return None
                agg: dict[str, int | float] = {}
                for sp in recent:
                    s = sp.get("stat", {})
                    for key in ("atBats", "hits", "homeRuns", "rbi", "baseOnBalls",
                                "strikeOuts", "stolenBases", "totalBases",
                                "plateAppearances", "doubles", "triples"):
                        agg[key] = agg.get(key, 0) + int(s.get(key) or 0)
                agg["gamesPlayed"] = len(recent)
                ab = agg.get("atBats", 0)
                agg["avg"] = round(agg.get("hits", 0) / ab, 3) if ab else 0.0
                bb  = agg.get("baseOnBalls", 0)
                h   = agg.get("hits", 0)
                obp_denom = ab + bb + agg.get("plateAppearances", 0) - ab - bb
                agg["obp"] = round((h + bb) / max(ab + bb, 1), 3)
                tb  = agg.get("totalBases", 0)
                agg["slg"] = round(tb / max(ab, 1), 3)
                agg["ops"] = round(agg["obp"] + agg["slg"], 3)
                return agg
    except Exception:
        pass
    return None


def _streak_score(stat: dict, min_pa: int = 8) -> float:
    """Score a hitting stat dict for streak hotness. Returns 0 if not qualifying."""
    pa    = int(stat.get("plateAppearances") or stat.get("atBats") or 0)
    ab    = int(stat.get("atBats") or 0)
    if pa < min_pa or ab < 1:
        return 0.0
    avg_f = float(stat.get("avg") or 0)
    ops_f = float(stat.get("ops") or 0)
    hr    = int(stat.get("homeRuns") or 0)
    rbi   = int(stat.get("rbi") or 0)
    sb    = int(stat.get("stolenBases") or 0)
    score  = max(0, avg_f - 0.280) * 120
    score += max(0, ops_f - 0.750) * 30
    score += hr  * 6.0
    score += rbi * 1.5
    score += sb  * 3.0
    return score


def _build_streak_candidate(mlb_id: int, row: dict, stat: dict,
                             window_label: str, season: int,
                             iso_week: str, score: float) -> StatCandidate:
    name = str(row.get("PlayerName") or "")
    team = str(row.get("TeamNameAbb") or row.get("TeamName") or "")
    pos  = str(row.get("positionDB") or row.get("Pos") or "")
    today = _et_date(0)

    g   = int(stat.get("gamesPlayed") or 0)
    ab  = int(stat.get("atBats") or 0)
    h   = int(stat.get("hits") or 0)
    hr  = int(stat.get("homeRuns") or 0)
    rbi = int(stat.get("rbi") or 0)
    bb  = int(stat.get("baseOnBalls") or 0)
    sb  = int(stat.get("stolenBases") or 0)
    avg_f = float(stat.get("avg") or 0)
    ops_f = float(stat.get("ops") or 0)

    avg_str = f".{str(int(round(avg_f * 1000))).zfill(3)}"
    ops_str = f"{ops_f:.3f}"
    hit_str = f"{h}-for-{ab}" if ab else f"{h} H"

    extras = []
    if hr >= 2:   extras.append(f"{hr} HRs")
    elif hr == 1: extras.append("1 HR")
    if rbi >= 3:  extras.append(f"{rbi} RBI")
    if sb >= 2:   extras.append(f"{sb} SB")

    extra_str = (", " + ", ".join(extras)) if extras else ""
    stat_desc = f"{name} is {hit_str} ({avg_str}) over {window_label}{extra_str}"
    context   = (
        f"{window_label} ({g} G): {hit_str} ({avg_str} AVG), {hr} HR, {rbi} RBI, "
        f"{bb} BB, OPS {ops_str}. "
        f"Season: {int(row.get('HR') or 0)} HR, {float(row.get('AVG') or 0):.3f} AVG. "
        f"Player recognition: {_recognition(name)}."
    )
    return StatCandidate(
        candidate_id=f"weekly_{season}_{iso_week}_hit_{mlb_id}_{window_label.replace(' ', '')}",
        player_name=name,
        mlb_id=mlb_id,
        team=team,
        team_abbrev=team,
        position=pos,
        stat_type="weekly_hitting",
        stat_description=stat_desc,
        context=context,
        page_url=f"{config.SITE_URL}/player?mlbId={mlb_id}&name={name.replace(' ', '+')}",
        score=score,
        raw_stats={**dict(stat), "window_label": window_label},
        date=today,
    )


def collect_weekly_hitters(season: int, top_n: int = 30) -> list[StatCandidate]:
    """
    For the top PA-leaders, check both their last-7-days splits AND their
    last-3-game log. Whichever window shows the hotter streak is used.
    Runs concurrently so the batch completes in a few seconds.
    """
    candidates: list[StatCandidate] = []

    try:
        bat_rows = [r for r in _fg_batting(season) if not _is_multi_team(r)]
    except Exception as exc:
        log.warning("FanGraphs batting unavailable for weekly trends: %s", exc)
        return []

    top_hitters = sorted(bat_rows, key=lambda r: float(r.get("PA") or 0), reverse=True)[:top_n]
    iso_week = datetime.now(timezone.utc).strftime("%Gw%V")

    def _fetch_row(row: dict):
        mlb_id = int(row["xMLBAMID"])
        l7, _  = _fetch_recent_splits(mlb_id, season)
        l3     = _compute_last_n_games(mlb_id, season, n=3)
        return mlb_id, l7, l3, row

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(_fetch_row, top_hitters))

    seen: set[int] = set()  # one candidate per player max
    for mlb_id, l7, l3, row in results:
        if mlb_id in seen:
            continue

        # Score each window; pick whichever tells the better story
        s7 = _streak_score(l7, min_pa=10) if l7 else 0.0
        s3 = _streak_score(l3, min_pa=8)  if l3 else 0.0

        best_score  = max(s7, s3)
        best_stat   = l7 if s7 >= s3 else l3
        best_window = "the last 7 days" if s7 >= s3 else "his last 3 games"

        # s3 gets a small bonus — shorter window = hotter streak
        if s3 > s7:
            best_score *= 1.15

        if best_score < 8 or best_stat is None:
            continue

        seen.add(mlb_id)
        candidates.append(_build_streak_candidate(
            mlb_id, row, best_stat, best_window, season, iso_week, best_score
        ))

    log.info("Collected %d weekly hitter candidates", len(candidates))
    return candidates


def collect_team_game_standouts(lookback_days: int = 1) -> list[StatCandidate]:
    """
    Scan completed games for notable team-level performances:
    high run totals, blowouts, shutouts, and slugfests.
    Uses the linescore already hydrated in the schedule response — no extra API calls.
    """
    candidates: list[StatCandidate] = []

    for day in range(1, lookback_days + 1):
        date_str = _et_date(day)
        try:
            games = _fetch_schedule(date_str)
        except Exception as exc:
            log.warning("Team standouts: schedule fetch failed for %s: %s", date_str, exc)
            continue

        for game in games:
            status = game.get("status", {}).get("detailedState", "")
            if "Final" not in status:
                continue

            game_pk   = game.get("gamePk", 0)
            linescore = game.get("linescore", {})
            ls_teams  = linescore.get("teams", {})

            home_info  = game.get("teams", {}).get("home", {}).get("team", {})
            away_info  = game.get("teams", {}).get("away", {}).get("team", {})
            home_name  = home_info.get("name", "Home")
            away_name  = away_info.get("name", "Away")
            home_abbr  = home_info.get("abbreviation", "")
            away_abbr  = away_info.get("abbreviation", "")
            home_id    = home_info.get("id", 0)
            away_id    = away_info.get("id", 0)

            home_r = int(ls_teams.get("home", {}).get("runs") or 0)
            away_r = int(ls_teams.get("away", {}).get("runs") or 0)
            home_h = int(ls_teams.get("home", {}).get("hits") or 0)
            away_h = int(ls_teams.get("away", {}).get("hits") or 0)

            total_runs = home_r + away_r
            margin     = abs(home_r - away_r)

            def _add(team_name, team_abbr, team_id, runs, hits, opp_name, opp_r,
                     cand_type, score, stat_desc, context):
                candidates.append(StatCandidate(
                    candidate_id=f"team_{game_pk}_{team_id}_{cand_type}",
                    player_name=team_name,   # reuse player_name field for team name
                    mlb_id=0,                # no single player
                    team=team_name,
                    team_abbrev=team_abbr,
                    position="TEAM",
                    stat_type="team_game",
                    stat_description=stat_desc,
                    context=context,
                    page_url=f"{config.SITE_URL}/team-stats",
                    score=score,
                    raw_stats={"runs": runs, "hits": hits, "opp_runs": opp_r},
                    date=date_str,
                ))

            # ── High-scoring offense ──────────────────────────────────
            for team_name, team_abbr, team_id, runs, hits, opp_name, opp_r in [
                (home_name, home_abbr, home_id, home_r, home_h, away_name, away_r),
                (away_name, away_abbr, away_id, away_r, away_h, home_name, home_r),
            ]:
                if runs >= 10:
                    score = (runs - 9) * 4.0   # 10R=4, 12R=12, 15R=24
                    if runs >= 15: score += 10
                    stat_desc = (
                        f"The {team_name} dropped {runs} runs on {hits} hits last night"
                        f", beating the {opp_name} {runs}-{opp_r}"
                    )
                    context = (
                        f"{team_name} scored {runs} runs on {hits} hits. "
                        f"Final score: {team_name} {runs}, {opp_name} {opp_r}. "
                        f"Total combined runs in the game: {total_runs}."
                    )
                    _add(team_name, team_abbr, team_id, runs, hits, opp_name, opp_r,
                         "offense", score, stat_desc, context)

            # ── Shutout ───────────────────────────────────────────────
            if home_r == 0 or away_r == 0:
                if home_r == 0:
                    win_name, win_abbr, win_id  = away_name, away_abbr, away_id
                    loss_name = home_name
                    win_r, loss_r, win_h = away_r, home_r, away_h
                else:
                    win_name, win_abbr, win_id  = home_name, home_abbr, home_id
                    loss_name = away_name
                    win_r, loss_r, win_h = home_r, away_r, home_h

                score = 14.0 + (win_r * 0.5)   # bigger shutout win scores higher
                stat_desc = (
                    f"The {win_name} shut out the {loss_name} {win_r}-0 last night"
                )
                context = (
                    f"{win_name} shutout: {win_r}-0 final, {win_h} hits on offense. "
                    f"{loss_name} held to 0 runs."
                )
                _add(win_name, win_abbr, win_id, win_r, win_h, loss_name, 0,
                     "shutout", score, stat_desc, context)

            # ── High-scoring combined slugfest ────────────────────────
            if total_runs >= 18:
                score = (total_runs - 17) * 3.0
                win_name  = home_name if home_r > away_r else away_name
                loss_name = away_name if home_r > away_r else home_name
                stat_desc = (
                    f"The {home_name} and {away_name} combined for {total_runs} runs last night"
                    f" — {home_r}-{away_r} final"
                )
                context = (
                    f"Slugfest: {home_name} {home_r}, {away_name} {away_r}. "
                    f"{total_runs} total runs, {home_h + away_h} combined hits."
                )
                _add(win_name, home_abbr if home_r > away_r else away_abbr,
                     home_id if home_r > away_r else away_id,
                     max(home_r, away_r), home_h + away_h, loss_name,
                     min(home_r, away_r), "slugfest", score, stat_desc, context)

    log.info("Collected %d team game candidates", len(candidates))
    return candidates


def collect_team_streaks(season: int) -> list[StatCandidate]:
    """
    Check current standings for notable win/loss streaks.
    Uses the MLB standings endpoint — no per-game calls needed.
    """
    candidates: list[StatCandidate] = []
    today = _et_date(0)

    try:
        data = _mlb("/standings",
                    leagueId="103,104", season=season,
                    standingsType="regularSeason",
                    hydrate="team,streak,records")
    except Exception as exc:
        log.warning("Standings fetch failed: %s", exc)
        return []

    for division in data.get("records", []):
        for rec in division.get("teamRecords", []):
            streak_raw = rec.get("streak", {}).get("streakCode", "")  # e.g. "W8" or "L5"
            if not streak_raw or len(streak_raw) < 2:
                continue

            kind   = streak_raw[0]   # "W" or "L"
            try:
                length = int(streak_raw[1:])
            except ValueError:
                continue

            if length < 5:   # only notable streaks (5+)
                continue

            team      = rec.get("team", {})
            team_name = team.get("name", "")
            team_abbr = team.get("abbreviation", "")
            team_id   = team.get("id", 0)
            wins      = rec.get("wins", 0)
            losses    = rec.get("losses", 0)
            pct       = rec.get("pct", ".000")

            score = (length - 4) * 5.0   # 5-game streak=5, 8-game=20, 10-game=30
            if length >= 8:  score += 10
            if length >= 10: score += 10

            if kind == "W":
                stat_desc = f"The {team_name} have won {length} in a row"
                context   = (
                    f"{team_name} are on a {length}-game win streak. "
                    f"Current record: {wins}-{losses} ({pct}). "
                    f"They are rolling right now."
                )
            else:
                stat_desc = f"The {team_name} have lost {length} straight"
                context   = (
                    f"{team_name} are on a {length}-game losing streak. "
                    f"Current record: {wins}-{losses} ({pct}). "
                    f"Things are not going well."
                )

            candidates.append(StatCandidate(
                candidate_id=f"streak_{season}_{team_id}_{kind}{length}",
                player_name=team_name,
                mlb_id=0,
                team=team_name,
                team_abbrev=team_abbr,
                position="TEAM",
                stat_type="team_game",
                stat_description=stat_desc,
                context=context,
                page_url=f"{config.SITE_URL}/standings",
                score=score,
                raw_stats={"streak": streak_raw, "wins": wins, "losses": losses},
                date=today,
            ))

    log.info("Collected %d team streak candidates", len(candidates))
    return candidates


def _build_combined_candidate(game_cand: StatCandidate,
                              weekly_cand: StatCandidate) -> StatCandidate:
    """
    Merge a single-game highlight with a hot-streak window into one candidate.
    Gives Claude both stat lines so it can write the "last night + last N games" format.
    """
    name      = game_cand.player_name
    game_date = game_cand.date

    # ── Game line ──────────────────────────────────────────────────────
    gs   = game_cand.raw_stats
    g_h  = int(gs.get("hits", 0))
    g_ab = int(gs.get("atBats", 0))
    g_hr = int(gs.get("homeRuns", 0))
    g_rbi = int(gs.get("rbi", 0))
    g_sb  = int(gs.get("stolenBases", 0))
    g_tb  = int(gs.get("totalBases", 0))

    game_parts = [f"{g_h}-for-{g_ab}"]
    if g_hr >= 1: game_parts.append(f"{g_hr} HR{'s' if g_hr > 1 else ''}")
    if g_rbi >= 1: game_parts.append(f"{g_rbi} RBI")
    if g_sb >= 1: game_parts.append(f"{g_sb} SB")

    # ── Streak line ────────────────────────────────────────────────────
    ws           = weekly_cand.raw_stats
    window_label = str(ws.get("window_label", "his last 3 games"))
    w_h   = int(ws.get("hits", 0))
    w_ab  = int(ws.get("atBats", 0))
    w_hr  = int(ws.get("homeRuns", 0))
    w_rbi = int(ws.get("rbi", 0))
    w_sb  = int(ws.get("stolenBases", 0))
    w_ops = float(ws.get("ops", 0))

    streak_parts = [f"{w_h}-for-{w_ab}"]
    if w_hr >= 1: streak_parts.append(f"{w_hr} HR{'s' if w_hr > 1 else ''}")
    if w_rbi >= 1: streak_parts.append(f"{w_rbi} RBI")
    if w_sb >= 1: streak_parts.append(f"{w_sb} SB")
    if w_ops > 0: streak_parts.append(f"{w_ops:.3f} OPS")

    # Use a short display label for the streak window
    if "7" in window_label:
        window_display = "Last 7 days"
    else:
        window_display = "Last 3 games"

    stat_desc = (
        f"{name} last night: {', '.join(game_parts)}\n"
        f"{window_display}: {', '.join(streak_parts)}"
    )

    context = (
        f"Game date: {_day_name(game_date)} ({game_date}). "
        f"Last night: {g_h}/{g_ab}, {g_hr} HR, {g_rbi} RBI, {g_tb} TB, {g_sb} SB. "
        f"{window_display}: {w_h}/{w_ab}, {w_hr} HR, {w_rbi} RBI, OPS {w_ops:.3f}. "
        f"Player recognition: {_recognition(name)}."
    )

    # Score is the sum of both signals with a combo bonus
    combined_score = (game_cand.score + weekly_cand.score) * 0.6 + 5.0

    return StatCandidate(
        candidate_id=f"combined_{game_cand.mlb_id}_{game_date}",
        player_name=name,
        mlb_id=game_cand.mlb_id,
        team=game_cand.team,
        team_abbrev=game_cand.team_abbrev,
        position=game_cand.position,
        stat_type="combined_hitting",
        stat_description=stat_desc,
        context=context,
        page_url=game_cand.page_url,
        score=combined_score,
        raw_stats={**gs, "window_label": window_label, "weekly": dict(ws)},
        date=game_date,
    )


def collect_all(season: int, lookback_days: int = 1,
                last_tweet_type: str | None = None,
                last_stat_type: str | None = None) -> list[StatCandidate]:
    """Collect all candidates and apply variety weighting so no single type dominates."""
    game_candidates   = collect_game_standouts(lookback_days)
    weekly_candidates = collect_weekly_hitters(season)
    season_candidates = collect_season_leaders(season)
    team_candidates   = collect_team_game_standouts(lookback_days) + collect_team_streaks(season)

    # Recency boost for single-game candidates
    for c in game_candidates:
        c.score += 4.0

    # ── Build combined "last night + hot streak" candidates ───────────
    # Find players who appear in both game_hitting and weekly_hitting.
    game_by_player: dict[int, StatCandidate] = {
        c.mlb_id: c for c in game_candidates if c.stat_type == "game_hitting"
    }
    weekly_by_player: dict[int, StatCandidate] = {
        c.mlb_id: c for c in weekly_candidates if c.stat_type == "weekly_hitting"
    }
    combined_candidates: list[StatCandidate] = []
    for mlb_id, game_c in game_by_player.items():
        if mlb_id in weekly_by_player:
            combined_candidates.append(
                _build_combined_candidate(game_c, weekly_by_player[mlb_id])
            )
    log.info("Built %d combined hitting candidates", len(combined_candidates))

    all_candidates = (game_candidates + weekly_candidates + combined_candidates
                      + season_candidates + team_candidates)

    # ── Per-type multipliers ──────────────────────────────────────────
    # Start with defaults (slight hitter preference overall)
    mults: dict[str, float] = {
        "game_hitting":     1.3,
        "weekly_hitting":   1.3,
        "combined_hitting": 1.5,   # combo story is the strongest format
        "team_game":        1.3,
        "season_batting":   1.1,
        "game_pitching":    1.0,
        "season_pitching":  1.0,
    }

    # After a pitching tweet → strongly prefer any hitting type
    if last_tweet_type == "pitching":
        mults["game_hitting"]     = 1.7
        mults["weekly_hitting"]   = 1.5
        mults["combined_hitting"] = 1.9
        mults["team_game"]        = 1.4
        mults["game_pitching"]    = 0.7
        mults["season_pitching"]  = 0.7

    # Penalise the exact same category that just ran so it can't chain
    if last_stat_type:
        mults[last_stat_type] = mults.get(last_stat_type, 1.0) * 0.4

    for c in all_candidates:
        c.score *= mults.get(c.stat_type, 1.0)

    all_candidates.sort(key=lambda c: c.score, reverse=True)
    log.info("Total candidates: %d (last_tweet=%s, last_stat=%s)",
             len(all_candidates), last_tweet_type, last_stat_type)
    return all_candidates
