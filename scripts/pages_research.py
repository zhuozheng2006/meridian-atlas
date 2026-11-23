"""Use the public reading inventory to trim download links and saved-text indexes."""

import json
import subprocess


def research_files(repo, source_ref):
    path = 'public/data/public-reading-files.json'
    raw = subprocess.check_output(['git', 'show', f'{source_ref}:{path}'], cwd=repo)
    return set(json.loads(raw))


def public_research_catalog(path, source_bytes, allowed_files):
    if path == 'research-reading-data.js':
        prefix, suffix = 'export const READING_CATALOG=freeze(', ');'
    elif path == 'research-original-text-data.js':
        prefix, suffix = 'export const SAVED_TEXTS=', ';'
    else:
        return source_bytes

    header, marker, payload = source_bytes.decode('utf-8').partition(prefix)
    data, end = json.JSONDecoder().raw_decode(payload)
    if not marker or payload[end:].strip() != suffix:
        raise ValueError(f'Unexpected generated module format: {path}')

    if path == 'research-reading-data.js':
        for card in data['cards']:
            if (card.get('localURL') or '').removeprefix('./') not in allowed_files:
                card['localURL'] = None
        data['sourceManifest'] = None
        data['sourceManifests'] = []
    else:
        data['documents'] = [doc for doc in data['documents'] if
                             f"data/research-evidence/{doc['collection']}/{doc['file']}" in allowed_files]

    compact = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    return (header + marker + compact + suffix + '\n').encode('utf-8')
