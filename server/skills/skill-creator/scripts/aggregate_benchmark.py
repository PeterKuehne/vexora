# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""Aggregates compare_skill results into benchmark.json format.

Usage: echo '[{...}, {...}]' | uv run aggregate_benchmark.py --skill-name "my-skill"
Input: JSON array of compare_skill metadata objects via stdin
Output: benchmark.json (stdout)

Schema: see references/schemas.md
"""

import json
import math
import sys
from datetime import datetime, timezone


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def stddev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = mean(values)
    return math.sqrt(sum((x - m) ** 2 for x in values) / (len(values) - 1))


def format_delta(a: float, b: float) -> str:
    d = a - b
    return f"+{d:.2f}" if d >= 0 else f"{d:.2f}"


def aggregate(runs: list[dict], skill_name: str) -> dict:
    """Aggregate compare_skill results into benchmark format."""

    with_skill_stats = {"pass_rates": [], "times": [], "tokens": []}
    without_skill_stats = {"pass_rates": [], "times": [], "tokens": []}
    formatted_runs = []
    notes = []

    for i, run in enumerate(runs):
        ws = run.get("withSkill", {})
        bl = run.get("baseline", {})

        # With skill stats
        ws_tokens = ws.get("tokens", 0)
        ws_time = ws.get("durationMs", 0) / 1000
        ws_has_answer = ws.get("hasAnswer", False)
        with_skill_stats["pass_rates"].append(1.0 if ws_has_answer else 0.0)
        with_skill_stats["times"].append(ws_time)
        with_skill_stats["tokens"].append(ws_tokens)

        # Baseline stats
        bl_tokens = bl.get("tokens", 0)
        bl_time = bl.get("durationMs", 0) / 1000
        bl_has_answer = bl.get("hasAnswer", False)
        without_skill_stats["pass_rates"].append(1.0 if bl_has_answer else 0.0)
        without_skill_stats["times"].append(bl_time)
        without_skill_stats["tokens"].append(bl_tokens)

        # Formatted run entry
        formatted_runs.append({
            "eval_id": i + 1,
            "eval_name": run.get("skillName", f"eval-{i+1}"),
            "configuration": "with_skill",
            "result": {
                "pass_rate": 1.0 if ws_has_answer else 0.0,
                "time_seconds": round(ws_time, 1),
                "tokens": ws_tokens,
                "tool_calls": ws.get("steps", 0),
                "errors": 0 if ws_has_answer else 1,
            },
        })
        formatted_runs.append({
            "eval_id": i + 1,
            "eval_name": run.get("skillName", f"eval-{i+1}"),
            "configuration": "without_skill",
            "result": {
                "pass_rate": 1.0 if bl_has_answer else 0.0,
                "time_seconds": round(bl_time, 1),
                "tokens": bl_tokens,
                "tool_calls": bl.get("steps", 0),
                "errors": 0 if bl_has_answer else 1,
            },
        })

        # Notes
        if not ws_has_answer and bl_has_answer:
            notes.append(f"Eval {i+1}: Skill hat keine Antwort generiert, Baseline schon — Skill muss verbessert werden")
        if ws_has_answer and not bl_has_answer:
            notes.append(f"Eval {i+1}: Skill hat Antwort, Baseline nicht — Skill ist klar besser")
        if ws_tokens > bl_tokens * 2:
            notes.append(f"Eval {i+1}: Skill verbraucht {ws_tokens/bl_tokens:.1f}x mehr Tokens als Baseline")

    # Summary
    ws_pr = with_skill_stats["pass_rates"]
    bl_pr = without_skill_stats["pass_rates"]

    benchmark = {
        "metadata": {
            "skill_name": skill_name,
            "model": "ovh:gpt-oss-120b",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "evals_run": list(range(1, len(runs) + 1)),
        },
        "runs": formatted_runs,
        "run_summary": {
            "with_skill": {
                "pass_rate": {"mean": round(mean(ws_pr), 2), "stddev": round(stddev(ws_pr), 2)},
                "time_seconds": {"mean": round(mean(with_skill_stats["times"]), 1), "stddev": round(stddev(with_skill_stats["times"]), 1)},
                "tokens": {"mean": round(mean(with_skill_stats["tokens"])), "stddev": round(stddev(with_skill_stats["tokens"]))},
            },
            "without_skill": {
                "pass_rate": {"mean": round(mean(bl_pr), 2), "stddev": round(stddev(bl_pr), 2)},
                "time_seconds": {"mean": round(mean(without_skill_stats["times"]), 1), "stddev": round(stddev(without_skill_stats["times"]), 1)},
                "tokens": {"mean": round(mean(without_skill_stats["tokens"])), "stddev": round(stddev(without_skill_stats["tokens"]))},
            },
            "delta": {
                "pass_rate": format_delta(mean(ws_pr), mean(bl_pr)),
                "time_seconds": format_delta(mean(with_skill_stats["times"]), mean(without_skill_stats["times"])),
                "tokens": format_delta(mean(with_skill_stats["tokens"]), mean(without_skill_stats["tokens"])),
            },
        },
        "notes": notes if notes else ["Keine besonderen Auffaelligkeiten"],
    }

    return benchmark


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Aggregate compare_skill results")
    parser.add_argument("--skill-name", required=True, help="Name of the skill")
    args = parser.parse_args()

    try:
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}"}), file=sys.stderr)
        sys.exit(1)

    if not isinstance(input_data, list):
        input_data = [input_data]

    result = aggregate(input_data, args.skill_name)
    print(json.dumps(result, ensure_ascii=False, indent=2))
