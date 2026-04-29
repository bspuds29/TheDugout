"""
Data collection: pulls yesterday's game standouts and current season leaders
from the MLB Stats API and FanGraphs API (same sources the website uses).
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import requests

import config

log = logging.getLogger(__name__)

MLB_API = "https://statsapi.mlb.com/api/v1"
FG_API  = "https://www.fangraphs.com/api/leaders/major-league/data"

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

    score  = hr  * 6.0
    score += rbi * 1.5
    score += max(0, hits - 2) * 2.0
    score += max(0, tb - 3) * 0.8
    score += sb  * 2.0

    if hr >= 2:  score += 8.0
    if hr >= 3:  score += 12.0
    if hits >= 4: score += 5.0
    # Perfect average bonus (e.g. 3-for-3, 4-for-4)
    if ab >= 3 and hits == ab: score += 3.0
    return score


def _score_pitching(s: dict) -> float:
    k  = int(s.get("strikeOuts", 0))
    ip = _parse_ip(s.get("inningsPitched", "0"))
    er = int(s.get("earnedRuns", 0))
    h  = int(s.get("hits", 0))

    score  = k  * 1.8
    score += ip * 0.6
    if er == 0 and ip >= 6: score += 10.0
    if er == 0 and ip >= 8: score += 8.0   # near complete game shutout
    if ip >= 8:             score += 6.0
    if h == 0 and ip >= 5:  score += 25.0  # no-hit bid
    if k >= 10:             score += 6.0
    if k >= 12:             score += 6.0
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
                for score, person, meta in sorted(hit_candidates, key=lambda x: (x[0], x[1]["id"]), reverse=True)[:2]:
                    mlb_id = person["id"]
                    name   = person["fullName"]
                    desc, ctx = _build_hitting_description(name, meta["stats"])
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


def collect_all(season: int, lookback_days: int = 1) -> list[StatCandidate]:
    """Collect all candidates — recent games first, season leaders as fallback."""
    game_candidates   = collect_game_standouts(lookback_days)
    season_candidates = collect_season_leaders(season)

    # Boost game candidates — recency matters for social media
    for c in game_candidates:
        c.score += 5.0

    all_candidates = game_candidates + season_candidates
    all_candidates.sort(key=lambda c: c.score, reverse=True)
    log.info("Total candidates: %d", len(all_candidates))
    return all_candidates
