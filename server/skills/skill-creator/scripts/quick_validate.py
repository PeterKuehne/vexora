# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///

"""Validates SKILL.md structure following Anthropic best practices.

Usage: uv run quick_validate.py <skill_directory>
Exit:  0 = valid, 1 = invalid
Output: JSON { valid, errors, warnings }
"""

import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    # Fallback: parse frontmatter manually
    yaml = None


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from SKILL.md content."""
    if not content.startswith("---"):
        return {}, content

    end = content.find("---", 3)
    if end == -1:
        return {}, content

    frontmatter_str = content[3:end].strip()
    body = content[end + 3:].strip()

    if yaml:
        data = yaml.safe_load(frontmatter_str) or {}
    else:
        # Simple key: value parsing fallback
        data = {}
        for line in frontmatter_str.split("\n"):
            if ":" in line:
                key, _, value = line.partition(":")
                data[key.strip()] = value.strip()

    return data, body


def validate(skill_dir: str) -> dict:
    """Validate a skill directory."""
    errors = []
    warnings = []
    path = Path(skill_dir)

    # Check SKILL.md exists
    skill_md = path / "SKILL.md"
    if not skill_md.exists():
        errors.append("SKILL.md nicht gefunden")
        return {"valid": False, "errors": errors, "warnings": warnings}

    content = skill_md.read_text(encoding="utf-8")

    # Parse frontmatter
    frontmatter, body = parse_frontmatter(content)

    if not frontmatter:
        errors.append("Kein YAML-Frontmatter gefunden (muss mit --- beginnen)")
        return {"valid": False, "errors": errors, "warnings": warnings}

    # Validate name
    name = frontmatter.get("name", "")
    if not name:
        errors.append("Feld 'name' fehlt im Frontmatter")
    elif not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", name) and len(name) > 1:
        if " " in name:
            errors.append(f"Name '{name}' enthaelt Leerzeichen (nur kebab-case erlaubt)")
        elif "_" in name:
            errors.append(f"Name '{name}' enthaelt Unterstriche (nur kebab-case erlaubt)")
        elif name[0].isupper():
            errors.append(f"Name '{name}' beginnt mit Grossbuchstabe (nur Kleinbuchstaben erlaubt)")
    if len(name) > 64:
        errors.append(f"Name '{name}' ist zu lang ({len(name)} Zeichen, max 64)")

    # Validate description
    description = frontmatter.get("description", "")
    if not description:
        errors.append("Feld 'description' fehlt im Frontmatter")
    elif len(str(description)) > 1024:
        errors.append(f"Description ist zu lang ({len(str(description))} Zeichen, max 1024)")
    if "<" in str(description) or ">" in str(description):
        errors.append("Description enthaelt XML-Tags (< oder >) — nicht erlaubt")

    # Validate body
    if not body or len(body.strip()) < 10:
        errors.append("SKILL.md Body ist leer oder zu kurz")

    # Check body length
    line_count = len(body.split("\n"))
    if line_count > 500:
        warnings.append(f"SKILL.md Body hat {line_count} Zeilen (empfohlen: < 500). Lagere Details in references/ aus.")

    # Check references are referenced
    refs_dir = path / "references"
    if refs_dir.exists():
        ref_files = [f.name for f in refs_dir.iterdir() if f.is_file()]
        for ref in ref_files:
            if ref not in content:
                warnings.append(f"references/{ref} existiert aber wird nicht in SKILL.md referenziert")

    # Check scripts directory
    scripts_dir = path / "scripts"
    if scripts_dir.exists():
        script_files = [f.name for f in scripts_dir.iterdir() if f.is_file() and f.suffix == ".py"]
        if script_files:
            warnings.append(f"Scripts vorhanden: {', '.join(script_files)}")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "name": name,
        "description_length": len(str(description)),
        "body_lines": line_count if body else 0,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"valid": False, "errors": ["Usage: quick_validate.py <skill_directory>"]}))
        sys.exit(1)

    result = validate(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result["valid"] else 1)
