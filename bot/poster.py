"""
Posts tweets to X / Twitter using Tweepy.

Twitter API access levels:
  Free tier  — POST /2/tweets works (1,500 writes/month). No media upload.
  Basic tier — Full v1.1 + v2 access, including media upload ($100/month).

This module detects which tier is available:
  1. Always attempt media upload via v1.1 API.
  2. If media upload fails (403 / Forbidden), fall back to text-only tweet.
  3. Log which path was taken so the user knows what they're getting.
"""

from __future__ import annotations

import logging
import os
import tempfile

import tweepy

import config

log = logging.getLogger(__name__)


def _client_v2() -> tweepy.Client:
    return tweepy.Client(
        bearer_token=config.TWITTER_BEARER_TOKEN or None,
        consumer_key=config.TWITTER_API_KEY,
        consumer_secret=config.TWITTER_API_SECRET,
        access_token=config.TWITTER_ACCESS_TOKEN,
        access_token_secret=config.TWITTER_ACCESS_SECRET,
        wait_on_rate_limit=True,
    )


def _api_v1() -> tweepy.API:
    auth = tweepy.OAuth1UserHandler(
        config.TWITTER_API_KEY,
        config.TWITTER_API_SECRET,
        config.TWITTER_ACCESS_TOKEN,
        config.TWITTER_ACCESS_SECRET,
    )
    return tweepy.API(auth, wait_on_rate_limit=True)


def _upload_image(image_bytes: bytes) -> str | None:
    """
    Upload image bytes via v1.1 media upload.
    Returns the media_id string on success, or None if upload is not
    available on this API tier.
    """
    api = _api_v1()
    # Write to a temp file — Tweepy's media_upload requires a file path
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        media = api.media_upload(filename=tmp_path)
        log.info("Image uploaded — media_id: %s", media.media_id_string)
        return media.media_id_string
    except tweepy.Forbidden:
        log.warning(
            "Media upload returned 403 Forbidden — your API access level "
            "does not include media upload (Basic tier required at $100/month). "
            "Falling back to text-only tweet."
        )
        return None
    except tweepy.TweepyException as exc:
        log.warning("Media upload failed: %s — posting without image.", exc)
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def post_tweet(tweet_text: str, image_bytes: bytes | None = None) -> str | None:
    """
    Post a tweet, optionally with an attached image.
    Returns the tweet ID string on success, or None on failure.
    """
    media_ids = None

    if image_bytes:
        media_id = _upload_image(image_bytes)
        if media_id:
            media_ids = [media_id]

    client = _client_v2()
    try:
        response = client.create_tweet(
            text=tweet_text,
            media_ids=media_ids,
        )
        tweet_id = str(response.data["id"])
        had_image = bool(media_ids)
        log.info(
            "Tweet posted%s — id: %s",
            " with image" if had_image else " (text only)",
            tweet_id,
        )
        return tweet_id
    except tweepy.TweepyException as exc:
        log.error("Failed to post tweet: %s", exc)
        raise
