"""Diagnostic complet FFBB, sans écriture des données du site."""
import json
import logging
import sys

from ffbb_api_client_v2 import FFBBAPIClientV2, TokenManager
from ffbb_api_client_v2.utils.cache_manager import CacheConfig
from ffbb_api_client_v2.utils.retry_utils import RetryConfig, TimeoutConfig
from requests_cache import CachedSession

from ffbb_import import (
    ROOT, diagnostic, fetch_competitions, fetch_engagements, fetch_organism_names,
    import_calendar, load_previous_match_names, pool_reader, run_stage,
    diagnose_response, validate_response,
)


def main():
    config = json.loads((ROOT / 'data/ffbb-config.json').read_text(encoding='utf-8'))
    cache = CacheConfig(enabled=False, backend='memory')
    tokens = run_stage('tokens', lambda: TokenManager.get_tokens(cache_config=cache))
    session = CachedSession(backend='memory', expire_after=0)
    session.hooks['response'].extend([diagnose_response, validate_response])
    client = FFBBAPIClientV2.create(
        api_bearer_token=tokens.api_token,
        meilisearch_bearer_token=tokens.meilisearch_token,
        cached_session=session,
        directus_retry_config=RetryConfig(max_attempts=3),
        directus_timeout_config=TimeoutConfig(connect_timeout=10, read_timeout=60),
    )
    logging.getLogger('ffbb_api_client_v2.utils.converter_utils').setLevel(logging.ERROR)
    snapshot = run_stage('calendar', lambda: import_calendar(
        client, config, pool_reader(session, tokens.api_token, config['baseUrl']),
        lambda ids, warnings: fetch_competitions(
            session, tokens.api_token, config['baseUrl'], ids, warnings),
        lambda ids: fetch_engagements(client, ids),
        lambda ids, warnings: fetch_organism_names(
            session, tokens.api_token, config['baseUrl'], ids, warnings),
        load_previous_match_names()))
    diagnostic('calendar_summary', teams=len(snapshot['teams']),
               matches=len(snapshot['matches']), standings=len(snapshot['standings']),
               warnings=len(snapshot['warnings']))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        diagnostic('probe_failed', exception=type(error).__name__)
        sys.exit(1)
