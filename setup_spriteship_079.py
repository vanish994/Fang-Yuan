#!/usr/bin/env python3
"""Safely install SpriteShip Agent Skill 0.7.9 into the current Git repository.

- Verifies the official archive SHA-256/size and every manifest-listed file.
- Installs both complete SpriteShip skill trees, including references.
- Never writes to root AGENTS.md / CLAUDE.md or stores an API key.
- Backs up existing SpriteShip skill directories outside the repository.
- Adds the Codex MCP entry only if no conflicting entry already exists.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

MANIFEST_URL = "https://spriteship.com/agent-skill/manifest.json"
ZIP_URL = "https://spriteship.com/agent-skill/releases/0.7.9/spriteship-agent-skill.zip"
HOST = "https://spriteship.com"
ENDPOINT = "https://spriteship.com/mcp"
ENV_NAME = "SPRITESHIP_API_KEY"
VERSION = "0.7.9"
EXPECTED_ARCHIVE_SHA = "573ff32a8845a6d8990b4431c86a263e7b277c3c7255888b2eeca6553107a885"
EXPECTED_ARCHIVE_SIZE = 308863


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download(url: str, destination: Path) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "SpriteShip-Safe-Installer/0.7.9"})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    destination.write_bytes(data)
    return data


def git_root() -> Path:
    proc = subprocess.run(["git", "rev-parse", "--show-toplevel"], text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError("Run this installer from inside the intended game Git repository.")
    return Path(proc.stdout.strip()).resolve()


def list_tree(path: Path) -> list[str]:
    entries: list[str] = []
    if not path.exists() and not path.is_symlink():
        return entries
    if path.is_symlink():
        return [f"{path} [symbolic link -> {os.readlink(path)}]"]
    if path.is_file():
        return [str(path)]
    for p in sorted(path.rglob("*")):
        rel = p.relative_to(path).as_posix()
        if p.is_symlink():
            entries.append(f"{rel} [symbolic link -> {os.readlink(p)}]")
        elif p.is_file():
            entries.append(f"{rel} [{p.stat().st_size} bytes, sha256 {sha256(p.read_bytes())}]")
        elif p.is_dir():
            entries.append(f"{rel}/ [directory]")
    return entries


def copy_tree_preserving_links(src: Path, dst: Path) -> None:
    if src.is_symlink():
        raise RuntimeError(f"Refusing to replace skill directory that is a symlink: {src}")
    if src.is_dir():
        shutil.copytree(src, dst, symlinks=True)
    elif src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst, follow_symlinks=False)


def codex_config_path() -> Path:
    return Path.home() / ".codex" / "config.toml"


def read_mcp_config(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        import tomllib
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"WARNING: could not safely parse {path} ({exc}); will not change MCP settings.")
        return {"__parse_error__": True}


def main() -> int:
    print("SpriteShip 0.7.9 safe setup — no API key will be displayed or written to the repository.\n")
    try:
        root = git_root()
    except Exception as exc:
        print(f"STOP: {exc}")
        return 2
    print(f"Repository root: {root}")
    for name in ("AGENTS.md", "CLAUDE.md"):
        p = root / name
        if p.is_file():
            data = p.read_bytes()
            print(f"Preserving {name}: exists, {len(data)} bytes, sha256 {sha256(data)}")
        else:
            print(f"Preserving {name}: not present at repository root")

    targets = {
        "skills/spriteship/": root / ".agents" / "skills" / "spriteship",
        "skills/spriteship-maps/": root / ".agents" / "skills" / "spriteship-maps",
    }
    existing = [(src, dst) for src, dst in targets.items() if dst.exists() or dst.is_symlink()]
    if existing:
        print("\nExisting SpriteShip-owned target(s) found. Inventory for review:")
        for _, target in existing:
            if target.is_symlink():
                print(f"STOP: {target} is a symbolic link. It will not be replaced automatically; inspect it manually first.")
                return 3
            if target.exists() and not target.is_dir():
                print(f"STOP: {target} exists but is not a directory. It will not be replaced automatically.")
                return 3
            print(f"\n--- {target} ---")
            inventory = list_tree(target)
            print("\n".join(inventory[:100]) if inventory else "(empty)")
            if len(inventory) > 100:
                print(f"... {len(inventory)-100} more entries")

    backup_root = Path.home() / ".codex" / "backups" / "spriteship" / dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    if existing:
        answer = input("\nAfter verification, back up and replace the listed SpriteShip skill directories? Type REPLACE to continue: ").strip()
        if answer != "REPLACE":
            print("Stopped without changing existing skill files or MCP settings.")
            return 3
        backup_root.mkdir(parents=True, exist_ok=True)
        for _, target in existing:
            backup_dest = backup_root / target.name
            if target.is_symlink():
                (backup_root / (target.name + ".symlink.txt")).write_text(os.readlink(target), encoding="utf-8")
            else:
                copy_tree_preserving_links(target, backup_dest)
        print(f"Backup completed outside repository: {backup_root}")

    temp_dir = Path(tempfile.mkdtemp(prefix="spriteship-0.7.9-"))
    try:
        manifest_path = temp_dir / "manifest.json"
        zip_path = temp_dir / "spriteship-agent-skill.zip"
        manifest_bytes = download(MANIFEST_URL, manifest_path)
        manifest = json.loads(manifest_bytes.decode("utf-8"))
        if manifest.get("currentVersion") != VERSION:
            raise RuntimeError(f"Official manifest currentVersion is {manifest.get('currentVersion')!r}, not {VERSION}.")
        rel = manifest.get("release", {})
        if rel.get("updateRequired"):
            raise RuntimeError("Manifest says this release requires an update; refusing a stale installation.")
        if manifest.get("sha256") != EXPECTED_ARCHIVE_SHA or manifest.get("sizeBytes") != EXPECTED_ARCHIVE_SIZE:
            raise RuntimeError("Manifest archive hash/size does not match the pinned 0.7.9 release; refusing install.")
        zip_bytes = download(ZIP_URL, zip_path)
        if len(zip_bytes) != EXPECTED_ARCHIVE_SIZE:
            raise RuntimeError(f"Archive size mismatch: received {len(zip_bytes)} bytes; expected {EXPECTED_ARCHIVE_SIZE}.")
        if sha256(zip_bytes) != EXPECTED_ARCHIVE_SHA:
            raise RuntimeError("Archive SHA-256 mismatch; nothing was installed.")
        print(f"Verified release archive: {len(zip_bytes)} bytes, SHA-256 {EXPECTED_ARCHIVE_SHA}")

        extracted = temp_dir / "verified"
        extracted.mkdir()
        verified: dict[str, bytes] = {}
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = [n for n in zf.namelist() if not n.endswith("/")]
            for item in manifest.get("files", []):
                relpath = PurePosixPath(item["path"])
                if relpath.is_absolute() or ".." in relpath.parts:
                    raise RuntimeError(f"Unsafe manifest path rejected: {item['path']}")
                candidates = [n for n in names if PurePosixPath(n) == relpath or PurePosixPath(n).as_posix().endswith("/" + relpath.as_posix())]
                if len(candidates) != 1:
                    raise RuntimeError(f"Expected exactly one archive member for {item['path']}, found {len(candidates)}.")
                data = zf.read(candidates[0])
                if len(data) != item["sizeBytes"] or sha256(data) != item["sha256"]:
                    raise RuntimeError(f"Manifest verification failed for {item['path']}; nothing installed.")
                verified[item["path"]] = data
            if len(verified) != len(manifest.get("files", [])):
                raise RuntimeError("Not every manifest file was verified.")
        print(f"Verified all {len(verified)} manifest-listed archive files against per-file sizes and SHA-256.")

        stage = temp_dir / "stage"
        for source_prefix, destination in targets.items():
            prefix = source_prefix
            relevant = [p for p in verified if p.startswith(prefix)]
            if not relevant:
                raise RuntimeError(f"Release is missing complete skill tree {prefix}")
            for source_name in relevant:
                relative = source_name[len(prefix):]
                if not relative:
                    continue
                out = stage / destination.name / Path(*PurePosixPath(relative).parts)
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(verified[source_name])

        # Protect against partial write: move old dirs only after all release files were verified and staged.
        installed_targets: list[Path] = []
        try:
            for _, destination in targets.items():
                staged_dir = stage / destination.name
                if destination.exists() or destination.is_symlink():
                    if destination.is_symlink():
                        destination.unlink()
                    else:
                        shutil.rmtree(destination)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(staged_dir, destination)
                installed_targets.append(destination)
            # Verify every copied, installed SpriteShip-owned file against the manifest.
            for source_name, data in verified.items():
                for source_prefix, destination in targets.items():
                    if source_name.startswith(source_prefix):
                        relative = source_name[len(source_prefix):]
                        target_file = destination / Path(*PurePosixPath(relative).parts)
                        if not target_file.is_file() or target_file.stat().st_size != len(data) or sha256(target_file.read_bytes()) != sha256(data):
                            raise RuntimeError(f"Post-install verification failed for {target_file}")
            print("Installed and re-verified the full spriteship and spriteship-maps skill trees, including every reference.")
        except Exception:
            print("ERROR during install. Attempting to restore backed-up directories.")
            for _, dest in targets.items():
                if dest.is_symlink() or dest.is_file():
                    try: dest.unlink()
                    except OSError: pass
                elif dest.is_dir():
                    shutil.rmtree(dest, ignore_errors=True)
            if backup_root.exists():
                for _, dest in existing:
                    backup = backup_root / dest.name
                    if backup.is_dir() and not dest.exists():
                        shutil.copytree(backup, dest, symlinks=True)
            raise

    except Exception as exc:
        print(f"STOP: {exc}")
        print("No unverified release files were installed.")
        return 4
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    # Inspect and prepare the private Codex MCP entry without putting credentials in config.
    cfg = codex_config_path()
    parsed = read_mcp_config(cfg)
    if parsed.get("__parse_error__"):
        print(f"\nSkill installation succeeded; MCP config was not changed because {cfg} could not be parsed safely.")
        return 5
    # Inspect workspace-level Codex MCP settings too, but never mutate them.
    workspace_cfg = root / ".codex" / "config.toml"
    workspace_parsed = read_mcp_config(workspace_cfg) if workspace_cfg.exists() else {}
    if workspace_parsed.get("__parse_error__"):
        print(f"\nSkill installation succeeded; MCP config not changed because workspace config {workspace_cfg} could not be parsed safely.")
        return 5
    workspace_servers = workspace_parsed.get("mcp_servers", {}) or {}
    workspace_current = workspace_servers.get("spriteship") if isinstance(workspace_servers, dict) else None
    if workspace_current is not None:
        print(f"Found a workspace-level SpriteShip MCP entry in {workspace_cfg}; it will be preserved unchanged.")

    servers = parsed.get("mcp_servers", {}) or {}
    current = servers.get("spriteship") if isinstance(servers, dict) else None
    expected_matches = isinstance(current, dict) and current.get("url") == ENDPOINT and current.get("bearer_token_env_var") == ENV_NAME
    if expected_matches:
        print(f"MCP entry already configured correctly in {cfg}; leaving it unchanged.")
    elif current is not None:
        print(f"\nSkill installation succeeded, but an existing SpriteShip MCP entry differs in {cfg}.")
        print("I did not overwrite the existing private MCP entry. Review it manually before changing it.")
        print(f"Required endpoint: {ENDPOINT}; credential environment variable: {ENV_NAME} (name only, no value).")
        return 6
    else:
        codex = shutil.which("codex")
        if not codex:
            print("\nSkill installation succeeded, but the `codex` CLI was not found; MCP entry was not added.")
            print("Run: codex mcp add spriteship --url https://spriteship.com/mcp --bearer-token-env-var SPRITESHIP_API_KEY")
            return 7
        cmd = [codex, "mcp", "add", "spriteship", "--url", ENDPOINT, "--bearer-token-env-var", ENV_NAME]
        proc = subprocess.run(cmd, text=True, capture_output=True)
        if proc.returncode != 0:
            print("\nSkill installation succeeded, but Codex did not accept the MCP add command.")
            print((proc.stderr or proc.stdout).strip())
            print("MCP entry was not verified. Add it through Codex Settings → Plugins → MCPs → Add.")
            return 8
        print("Added the SpriteShip MCP entry to Codex using the env-var reference only; no key value was stored.")

    key_present = bool(os.environ.get(ENV_NAME))
    if key_present:
        print(f"{ENV_NAME} is present in this installer process (value intentionally not displayed).")
    else:
        print(f"\nNEXT REQUIRED STEP: provide your SpriteShip key privately as {ENV_NAME} in the environment that launches Codex, or use Codex's private credential controls if available.")
    print("Restart/reload Codex after setting credentials and changing MCP configuration. Then ask the selected Codex session to run whoami and list_projects.")
    print("The live MCP connection was NOT tested by this installer.")
    print("Root AGENTS.md, root CLAUDE.md, and unrelated rules were not written by this installer.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
