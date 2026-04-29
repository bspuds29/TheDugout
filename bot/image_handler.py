"""
Fetches player headshot images from MLB's public CDN — the same source
the website uses in PlayerHeadshot.tsx.  Returns a local bytes object
ready for upload to Twitter.

MLB CDN URL pattern (Cloudinary):
  https://img.mlbstatic.com/mlb-photos/image/upload/
    d_people:generic:headshot:silo:current.png/
    w_{width},q_auto:best/
    v1/people/{mlbId}/headshot/silo/current

The CDN serves a generic silhouette when no real photo exists, so this
never 404s.  We treat the silhouette as "no photo" by checking the
Content-Type or a known placeholder hash.
"""

from __future__ import annotations

import hashlib
import logging

import requests

log = logging.getLogger(__name__)

MLB_CDN = (
    "https://img.mlbstatic.com/mlb-photos/image/upload/"
    "d_people:generic:headshot:silo:current.png/"
    "w_{width},q_auto:best/"
    "v1/people/{mlb_id}/headshot/silo/current"
)

# MD5 of the known generic silhouette PNG (fetched once and hard-coded).
# If we get this hash back, we know there's no real player photo.
# We recompute it lazily on first use.
_SILHOUETTE_HASH: str | None = None
_SILHOUETTE_CHECKED = False


def _headshot_url(mlb_id: int, width: int = 200) -> str:
    return MLB_CDN.format(mlb_id=mlb_id, width=width)


def _silhouette_url(width: int = 200) -> str:
    # The fallback image URL — request a player ID that does not exist
    return MLB_CDN.format(mlb_id=0, width=width)


def _get_silhouette_hash() -> str:
    global _SILHOUETTE_HASH, _SILHOUETTE_CHECKED
    if not _SILHOUETTE_CHECKED:
        _SILHOUETTE_CHECKED = True
        try:
            r = requests.get(_silhouette_url(), timeout=15)
            r.raise_for_status()
            _SILHOUETTE_HASH = hashlib.md5(r.content).hexdigest()
            log.debug("Silhouette hash: %s", _SILHOUETTE_HASH)
        except Exception as exc:
            log.warning("Could not fetch silhouette hash: %s", exc)
    return _SILHOUETTE_HASH or ""


def fetch_headshot(mlb_id: int) -> bytes | None:
    """
    Download the player's headshot image bytes.
    Returns None if the player has no photo (only silhouette) or if the
    download fails.
    """
    url = _headshot_url(mlb_id, width=400)
    log.debug("Fetching headshot: %s", url)
    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        image_bytes = r.content
    except requests.RequestException as exc:
        log.warning("Headshot download failed for mlbId=%d: %s", mlb_id, exc)
        return None

    # Check if we got the generic silhouette instead of a real photo
    silhouette_hash = _get_silhouette_hash()
    if silhouette_hash:
        player_hash = hashlib.md5(image_bytes).hexdigest()
        if player_hash == silhouette_hash:
            log.info("No real headshot available for mlbId=%d (silhouette returned)", mlb_id)
            return None

    log.info("Headshot fetched for mlbId=%d (%d bytes)", mlb_id, len(image_bytes))
    return image_bytes
