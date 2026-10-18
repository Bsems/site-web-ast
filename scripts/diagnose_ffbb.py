"""Sonde limitée à la fiche club, sans import ni écriture des données du site."""
import json
import sys

from ffbb_api_client_v2 import FFBBAPIClientV2, TokenManager
from ffbb_api_client_v2.utils.cache_manager import CacheConfig
from ffbb_api_client_v2.utils.retry_utils import RetryConfig, TimeoutConfig
from requests_cache import CachedSession

from ffbb_import import ROOT, diagnostic, response_markers, run_stage


def observe(response, **kwargs):
    # Aucun paramètre, corps ou en-tête de requête n'est affiché.
    diagnostic('club_response', status=response.status_code,
               **response_markers(response))


def main():
    config = json.loads((ROOT / 'data/ffbb-config.json').read_text(encoding='utf-8'))
    tokens = run_stage('tokens', lambda: TokenManager.get_tokens(
        cache_config=CacheConfig(enabled=False, backend='memory')))
    session = CachedSession(backend='memory', expire_after=0)
    session.hooks['response'].append(observe)
    client = FFBBAPIClientV2.create(
        api_bearer_token=tokens.api_token, meilisearch_bearer_token=tokens.meilisearch_token,
        cached_session=session, directus_retry_config=RetryConfig(max_attempts=1),
        directus_timeout_config=TimeoutConfig(connect_timeout=10, read_timeout=30))
    run_stage('club', lambda: client.get_organisme(config['club']['id']))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        diagnostic('probe_failed', exception=type(error).__name__)
        sys.exit(1)
