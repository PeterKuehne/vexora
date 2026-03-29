# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""Generates a Markdown report from benchmark.json.

Usage: uv run generate_report.py <benchmark.json>
Output: Markdown report (stdout)
"""

import json
import sys
from pathlib import Path


def generate_report(benchmark: dict) -> str:
    """Generate Markdown report from benchmark data."""

    meta = benchmark.get("metadata", {})
    summary = benchmark.get("run_summary", {})
    runs = benchmark.get("runs", [])
    notes = benchmark.get("notes", [])

    ws = summary.get("with_skill", {})
    bl = summary.get("without_skill", {})
    delta = summary.get("delta", {})

    skill_name = meta.get("skill_name", "unbekannt")
    timestamp = meta.get("timestamp", "")
    model = meta.get("model", "")

    lines = [
        f"# Benchmark Report: {skill_name}",
        "",
        f"**Zeitpunkt:** {timestamp}",
        f"**Modell:** {model}",
        f"**Anzahl Evals:** {len(meta.get('evals_run', []))}",
        "",
        "---",
        "",
        "## Zusammenfassung",
        "",
        "| Metrik | MIT Skill | OHNE Skill | Delta |",
        "|--------|-----------|------------|-------|",
    ]

    # Pass rate
    ws_pr = ws.get("pass_rate", {})
    bl_pr = bl.get("pass_rate", {})
    lines.append(
        f"| Pass Rate | {ws_pr.get('mean', 0):.0%} (±{ws_pr.get('stddev', 0):.0%}) "
        f"| {bl_pr.get('mean', 0):.0%} (±{bl_pr.get('stddev', 0):.0%}) "
        f"| {delta.get('pass_rate', '0')} |"
    )

    # Time
    ws_t = ws.get("time_seconds", {})
    bl_t = bl.get("time_seconds", {})
    lines.append(
        f"| Dauer | {ws_t.get('mean', 0):.1f}s (±{ws_t.get('stddev', 0):.1f}s) "
        f"| {bl_t.get('mean', 0):.1f}s (±{bl_t.get('stddev', 0):.1f}s) "
        f"| {delta.get('time_seconds', '0')}s |"
    )

    # Tokens
    ws_tok = ws.get("tokens", {})
    bl_tok = bl.get("tokens", {})
    lines.append(
        f"| Tokens | {ws_tok.get('mean', 0):.0f} (±{ws_tok.get('stddev', 0):.0f}) "
        f"| {bl_tok.get('mean', 0):.0f} (±{bl_tok.get('stddev', 0):.0f}) "
        f"| {delta.get('tokens', '0')} |"
    )

    lines.extend(["", "---", "", "## Einzelergebnisse", ""])

    # Per-eval breakdown
    eval_ids = sorted(set(r.get("eval_id") for r in runs))
    for eval_id in eval_ids:
        eval_runs = [r for r in runs if r.get("eval_id") == eval_id]
        eval_name = eval_runs[0].get("eval_name", f"Eval {eval_id}") if eval_runs else f"Eval {eval_id}"

        lines.append(f"### {eval_name}")
        lines.append("")
        lines.append("| Konfiguration | Pass Rate | Dauer | Tokens | Tool-Calls |")
        lines.append("|---------------|-----------|-------|--------|------------|")

        for run in eval_runs:
            config = run.get("configuration", "")
            result = run.get("result", {})
            label = "MIT Skill" if config == "with_skill" else "OHNE Skill"
            lines.append(
                f"| {label} "
                f"| {result.get('pass_rate', 0):.0%} "
                f"| {result.get('time_seconds', 0):.1f}s "
                f"| {result.get('tokens', 0)} "
                f"| {result.get('tool_calls', 0)} |"
            )

        lines.append("")

    # Notes
    if notes:
        lines.extend(["---", "", "## Beobachtungen", ""])
        for note in notes:
            lines.append(f"- {note}")
        lines.append("")

    # Recommendation
    ws_mean_pr = ws_pr.get("mean", 0)
    bl_mean_pr = bl_pr.get("mean", 0)

    lines.extend(["---", "", "## Empfehlung", ""])
    if ws_mean_pr > bl_mean_pr:
        lines.append(f"Der Skill **verbessert** die Ergebnisse (Pass Rate {ws_mean_pr:.0%} vs. {bl_mean_pr:.0%}).")
    elif ws_mean_pr == bl_mean_pr:
        lines.append("Der Skill zeigt **keinen messbaren Unterschied** zur Baseline.")
    else:
        lines.append(f"Die Baseline ist **besser** als der Skill (Pass Rate {bl_mean_pr:.0%} vs. {ws_mean_pr:.0%}). Der Skill sollte ueberarbeitet werden.")

    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: generate_report.py <benchmark.json>", file=sys.stderr)
        sys.exit(1)

    benchmark_path = Path(sys.argv[1])
    if not benchmark_path.exists():
        # Try reading from stdin
        try:
            data = json.loads(sys.stdin.read())
        except Exception:
            print(f"Datei nicht gefunden: {benchmark_path}", file=sys.stderr)
            sys.exit(1)
    else:
        data = json.loads(benchmark_path.read_text(encoding="utf-8"))

    print(generate_report(data))
