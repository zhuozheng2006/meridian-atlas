"""Shared CLI: all intermediate writes stay under an explicit build workspace."""
import argparse
from pathlib import Path

def workspace():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', type=Path, required=True,
                        help='Raw sources and derived assets; use a build/cache directory, not dist.')
    args = parser.parse_args()
    root = args.workspace.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root
