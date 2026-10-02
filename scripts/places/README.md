# Historical place data rebuild

This folder contains code, rules, download URLs and checksums. It contains no raw Pleiades, population, Natural Earth or Wikidata dataset. It rebuilds the 53 place assets used by the atlas; the 12 authored city readings remain a separate editorial asset.

## Requirements

- Python 3.9 or newer; `opencc-python-reimplemented==0.1.7` is the only nonstandard Python dependency.
- Node 20 or newer for the runtime validators (`fetch`, `Response`, `Blob`, `DecompressionStream`); no npm packages are required.
- The atlas's frozen `dist/data/enrichment/profiles/*.json.gz` files for extracting P36 capital statements.
- Roughly 200 MB of downloaded bulk inputs, plus Wikidata entity caches and temporary/derived storage. The full Pleiades JSON is loaded into memory; allow several GB of free RAM.

From the repository root:

```sh
python3 -m venv scripts/places/.venv
scripts/places/.venv/bin/python -m pip install -r scripts/places/requirements.txt
```

## Rebuild the frozen snapshot

`raw` and `derived` below are ignored working directories, not source-controlled data.

```sh
python3 scripts/places/extract_capitals.py \
  --profiles-dir dist/data/enrichment/profiles \
  --input-dir scripts/places/raw

python3 scripts/places/fetch_inputs.py \
  --input-dir scripts/places/raw

scripts/places/.venv/bin/python scripts/places/build.py \
  --input-dir scripts/places/raw \
  --output-dir scripts/places/derived \
  --built-at 2026-10-02T01:28:24.096158+00:00

python3 scripts/places/validate.py \
  --input-dir scripts/places/raw \
  --output-dir scripts/places/derived
```

Use a fresh `--output-dir` for each build. `--rules-dir` can point to an explicitly reviewed replacement for the included rules; `--manifest` selects a reviewed snapshot lock. The builder itself checks bulk inputs, entity contents and extracted capital claims against this lock before producing data. Omitting `--built-at` records the current UTC time. Only after validation should the generated `.json.gz` files be copied to `dist/data/places/`; the rebuild scripts do not publish or edit the Site.

For existing downloads, use `fetch_inputs.py --input-dir /path/to/cache --verify-only`; this makes no network requests. `--datasets-only` and `--entities-only` split the check/download work. `--workers 1..4` controls Wikidata concurrency; `--report /path/to/report.json` saves the outcome. Failed checks return a nonzero exit status.

The manifest pins six bulk input hashes, 121 Wikidata city revisions, 1,450 profile hashes, the ordering of 1,500 capital statements, and the expected derived asset hashes. Entity hashes use canonical JSON to ignore harmless transport formatting changes. Fixed revisions use Wikidata's documented `revision` query parameter.

Pleiades `latest` and Natural Earth's `master` URLs are mutable. If their new contents differ from the manifest, downloading stops instead of accepting the change. To reproduce this snapshot later, retain the original checked downloads in an external cache or retrieve an archived snapshot with matching hashes. Updating the manifest is a research refresh: review changed records, quarantine rules, counts and all regression checks. Reproduction from future `latest` endpoints is not guaranteed.

## Runtime validation

After copying the validators into the repository's `scripts/` folder:

```sh
node scripts/validate-places.mjs .
node scripts/validate-city-narratives.mjs .
```

The narrative validator can also be called from this directory with an explicit repository root. Its optional second positional argument is a JSON report path. It imports the actual `dist/city-narratives.js`, serves data through a local-file `fetch` stub, and requires no DOM or network. It checks all 39 source records and 39 source registrations, the 55 editorial regression examples, date/observation conflicts, identity isolation, period gaps and loading retries.

## Source inventory and reuse

| Source | Input | Terms | Meaning retained |
|---|---|---|---|
| Pleiades | Full JSON and GIS vocabulary ZIP | CC BY 3.0 | Attested cultural periods and source location accuracy; representative points remain a separate class |
| Natural Earth | 1:10m populated-places GeoJSON | Public domain | Modern reference places, with no inferred ancient existence |
| Reba, Reitsma & Seto / Figshare | Chandler and two Modelski V2 CSVs | CC BY 4.0 | Discrete dated population observations; no interpolation |
| Wikidata | Existing profile P36 statements and revision-pinned P625 city entities | CC0 | Explicit capital tenure and source references; no city lifespan inferred |

Exact URLs, hashes, attribution and licenses are in `input-manifest.json`. Dataset licenses remain distinct from the repository's code license. The editorial aliases and quarantine rules retain their evidence URLs. `build.py` writes attribution and filtering rules into `city-sources.json.gz`.

The selection rules intentionally preserve gaps, original coordinates, chronology precision and uncertain representative points. Two contradictory name attestations and eight clearly non-settlement features are quarantined in derived output while original downloads remain intact. The Modelski modern China column is assigned the paper's stated 1990 observation year. Related modern names do not become ancient-city aliases.

References for data access: [Pleiades downloads](https://pleiades.stoa.org/downloads), [Pleiades GIS package](https://atlantides.org/downloads/pleiades/gis/), [Wikidata data access](https://www.wikidata.org/wiki/Help:Data_access).
