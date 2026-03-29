# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""Analyzes a skill description against trigger queries and suggests improvements.

Usage: echo '{"description": "...", "queries": [...]}' | uv run improve_description.py
Input: JSON { description, queries: [{query, should_trigger}] }
Output: JSON { score, analysis, suggestions, improved_description }
"""

import json
import re
import sys


def extract_keywords(text: str) -> set[str]:
    """Extract meaningful keywords from text (3+ chars, lowercase)."""
    words = re.findall(r"[a-zäöüß]{3,}", text.lower())
    # Remove common German stop words
    stop_words = {
        "und", "oder", "der", "die", "das", "ein", "eine", "ist", "sind",
        "wird", "werden", "hat", "haben", "kann", "können", "soll", "sollen",
        "mit", "für", "von", "auf", "aus", "bei", "nach", "über", "unter",
        "nicht", "auch", "nur", "noch", "wie", "was", "wer", "wen", "wem",
        "dem", "den", "des", "dieser", "diese", "dieses", "aber", "wenn",
        "dann", "denn", "weil", "dass", "zum", "zur", "als",
    }
    return {w for w in words if w not in stop_words}


def analyze_trigger(description: str, query: str) -> dict:
    """Check if a query would likely trigger the skill based on keyword overlap."""
    desc_keywords = extract_keywords(description)
    query_keywords = extract_keywords(query)

    overlap = desc_keywords & query_keywords
    overlap_ratio = len(overlap) / max(len(query_keywords), 1)

    return {
        "overlap_keywords": sorted(overlap),
        "overlap_ratio": round(overlap_ratio, 2),
        "would_trigger": overlap_ratio > 0.15,  # Threshold: at least 15% keyword overlap
    }


def analyze(description: str, queries: list[dict]) -> dict:
    """Analyze description against queries and generate suggestions."""

    results = []
    correct = 0
    false_positives = []
    false_negatives = []

    for q in queries:
        query_text = q.get("query", "")
        should_trigger = q.get("should_trigger", True)
        analysis = analyze_trigger(description, query_text)

        is_correct = analysis["would_trigger"] == should_trigger
        if is_correct:
            correct += 1
        elif analysis["would_trigger"] and not should_trigger:
            false_positives.append(query_text)
        elif not analysis["would_trigger"] and should_trigger:
            false_negatives.append(query_text)

        results.append({
            "query": query_text,
            "should_trigger": should_trigger,
            "would_trigger": analysis["would_trigger"],
            "correct": is_correct,
            "overlap_keywords": analysis["overlap_keywords"],
            "overlap_ratio": analysis["overlap_ratio"],
        })

    score = correct / max(len(queries), 1)

    # Generate suggestions
    suggestions = []

    if false_negatives:
        # Find keywords in false negatives that are missing from description
        missing_keywords = set()
        for fn in false_negatives:
            fn_keywords = extract_keywords(fn)
            desc_keywords = extract_keywords(description)
            missing = fn_keywords - desc_keywords
            missing_keywords.update(missing)

        if missing_keywords:
            top_missing = sorted(missing_keywords)[:5]
            suggestions.append(
                f"Folgende Begriffe aus Should-Trigger-Queries fehlen in der Description: "
                f"{', '.join(top_missing)}. Fuege sie hinzu um den Trigger zu verbessern."
            )

    if false_positives:
        suggestions.append(
            f"Die Description triggert faelschlicherweise bei {len(false_positives)} Query(s). "
            f"Fuege negative Trigger hinzu, z.B. 'Nutze diesen Skill NICHT fuer [konkretes Gegenbeispiel]'."
        )

    if score < 0.7:
        suggestions.append(
            "Score unter 70% — die Description braucht grundlegende Ueberarbeitung. "
            "Beginne mit: [Was der Skill tut] + [Wann ihn nutzen] + [konkrete Trigger-Phrasen]."
        )

    return {
        "score": round(score, 2),
        "correct": correct,
        "total": len(queries),
        "false_positives": len(false_positives),
        "false_negatives": len(false_negatives),
        "results": results,
        "suggestions": suggestions,
    }


if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}), file=sys.stderr)
        sys.exit(1)

    description = input_data.get("description", "")
    queries = input_data.get("queries", [])

    if not description:
        print(json.dumps({"error": "Feld 'description' fehlt"}), file=sys.stderr)
        sys.exit(1)

    result = analyze(description, queries)
    print(json.dumps(result, ensure_ascii=False, indent=2))
