---
name: update-diagram
description: Create or update architecture diagrams in .memory/ai/diagrams/
argument-hint: [diagram-name or feature-description]
disable-model-invocation: true
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Update Architecture Diagram

Create or update Mermaid architecture diagrams for the Cor7ex project.

## When to Use

Invoke `/update-diagram` after:
- Implementing a new feature
- Adding new services or components
- Changing data flows or API routes
- Refactoring architecture

## Instructions

1. **Determine the diagram type** based on $ARGUMENTS:
   - If a specific diagram name is given (e.g., "auth-flow"), update that diagram
   - If a feature description is given, determine which diagram(s) need updating
   - If creating a new diagram, follow the naming convention: `<topic>-<type>-flow.md`

2. **Read the template** at [template.md](template.md) for the exact format

3. **Validate against code** - Always verify the diagram matches actual:
   - File paths (use Glob to confirm files exist)
   - Function/class names (use Grep to verify)
   - Service connections and data flows

4. **Update the README** at `.memory/ai/diagrams/README.md` if creating a new diagram

## Diagram Location

All diagrams are stored in: `.memory/ai/diagrams/`

## Existing Diagrams

Check the [README](../../../memory/ai/diagrams/README.md) for the current inventory.

## Example Output

See [examples/auth-flow.md](examples/auth-flow.md) for a complete example.

## Validation Checklist

Before finishing, verify:
- [ ] All file paths in "Key Components" exist
- [ ] Mermaid syntax is valid (no special chars like `/` unquoted)
- [ ] Flow diagram shows actual data/control flow
- [ ] Error scenarios are realistic for this codebase
- [ ] Dependencies list actual services used
