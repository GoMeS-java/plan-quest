#!/usr/bin/env python3
"""Run the complete synthetic regression without seed.json or personal accounts.

Requires the development dependencies from package-lock.json and Playwright's
Chromium, or CHROMIUM_EXECUTABLE_PATH. This is a desktop automated test runner;
it does not verify physical Android or real Google OAuth. It never edits src/.
"""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
for command in ([sys.executable, 'build.py'],
                [sys.executable, 'build.py', '--test'],
                ['npm', 'run', 'test:all']):
    subprocess.run(command, cwd=root, check=True)
