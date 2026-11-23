#!/usr/bin/env python3
"""Build a static Git tree from a committed atlas revision. Never moves a ref."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from pages_research import public_research_catalog, research_files

ROOT = Path(__file__).resolve().parents[1]


def git(*args, data=None, env=None):
    return subprocess.run(
        ["git", *args], cwd=ROOT, input=data, capture_output=True, check=True, env=env
    ).stdout


def object_id(revision):
    return git("rev-parse", "--verify", "--end-of-options", revision).decode().strip()


def build(revision, github):
    commit = object_id(revision + "^{commit}")
    public = object_id(commit + ":public")
    edits = []
    generated = {}

    def reuse(path, source):
        edits.append({"path": path, "mode": "100644", "type": "blob", "sha": object_id(source)})

    def write_text(path, content):
        blob = git("hash-object", "-w", "--stdin", data=content.encode()).decode().strip()
        edits.append({"path": path, "mode": "100644", "type": "blob", "sha": blob})
        generated[path] = content

    # V4 terms prohibit redistribution. Drop the source RAR, the derived index,
    # every geometry pack, and any additional files later placed in this directory.
    allowed = research_files(ROOT, commit)
    candidates = git("ls-tree", "-r", "-z", "--name-only", public, "--",
                     "data/chgis", "data/research-evidence",
                     "data/seshat/sources/code-book-4.20.2021.pdf")
    for value in filter(None, candidates.split(b"\0")):
        path = os.fsdecode(value)
        if path.startswith("data/research-evidence/") and path in allowed:
            continue
        edits.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
    for name in ("research-reading-data.js", "research-original-text-data.js"):
        source = git("show", commit + ":public/" + name)
        write_text(name, public_research_catalog(name, source, allowed).decode())

    html = git("show", commit + ":public/index.html").decode()
    tag = '<html lang="zh-CN">'
    if html.count(tag) != 1:
        raise ValueError("Could not identify the atlas document for the public edition")
    write_text("index.html", html.replace(tag, '<html lang="zh-CN" data-distribution="public">'))
    write_text(".nojekyll", "")
    for name in ("ATTRIBUTIONS.md", "LICENSE"):
        reuse(name, commit + ":" + name)

    # The Worker and Python server normally resolve this logical route. Pages
    # can serve the same compressed bytes under the alias, including hash queries.
    manifest = json.loads(git("show", commit + ":public/data/native/manifest.json"))
    for snapshot in manifest["bootstrap"].values():
        file = snapshot["file"]
        if not re.fullmatch(r"year--?\d+\.json\.gz", file):
            raise ValueError("Unexpected bootstrap filename: " + file)
        source = commit + ":public/data/native/" + file
        payload = git("show", source)
        if hashlib.sha256(payload).hexdigest() != snapshot["gzipSha256"]:
            raise ValueError("Bootstrap hash mismatch: " + file)
        reuse("__atlas-native/" + file, source)

    with tempfile.TemporaryDirectory() as folder:
        env = dict(os.environ, GIT_INDEX_FILE=os.path.join(folder, "index"))
        git("read-tree", public, env=env)
        entries = []
        for edit in edits:
            mode, sha = (edit["mode"], edit["sha"]) if edit["sha"] else ("0", "0" * len(commit))
            entries.append(f"{mode} {sha}\t{edit['path']}\0")
        git("update-index", "-z", "--index-info", data="".join(entries).encode(), env=env)
        tree = git("write-tree", env=env).decode().strip()
    if github:
        for edit in edits:
            if edit["path"] in generated:
                del edit["sha"]
                edit["content"] = generated[edit["path"]]
        print(json.dumps({"source_commit": commit, "tree": tree, "base_tree_sha": public,
                          "tree_elements": edits}, ensure_ascii=False))
    else:
        print(tree)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("revision", nargs="?", default="HEAD", help="source commit (default: HEAD)")
    parser.add_argument("--github", action="store_true", help="emit the equivalent GitHub tree API inputs")
    args = parser.parse_args()
    build(args.revision, args.github)
