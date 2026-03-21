# Diagram Template

Use this exact structure for all architecture diagrams.

---

## Required Sections

```markdown
# [Descriptive Title]

## Overview
[1-2 sentences describing what this diagram covers]

## Trigger Points
- [When this flow is initiated - bullet list]
- [User actions, system events, etc.]

## Flow Diagram
\`\`\`mermaid
graph TD
    A[Start] --> B[Step 1]
    B --> C{Decision?}
    C -->|Yes| D[Action A]
    C -->|No| E[Action B]
    D --> F[End]
    E --> F
\`\`\`

## Key Components
- **File**: `path/to/file.ts` - Description of purpose
- **Function**: `functionName()` - What it does
- **Database**: `tableName` - What data it stores

## Data Flow
1. Input: Description of input data
   \`\`\`typescript
   {
     field: type,
     // example structure
   }
   \`\`\`
2. Transformations:
   - Step 1 description
   - Step 2 description
3. Output: Description of output
   \`\`\`typescript
   {
     result: type,
   }
   \`\`\`

## Error Scenarios
- Error case 1
- Error case 2
- Error case 3

## Dependencies
- **ServiceName** `:port` - Purpose
- **Database** `:port` - What it stores
```

---

## Mermaid Syntax Notes

### Escape Special Characters
```mermaid
%% BAD - will cause syntax error
C --> H[/api/auth/*]

%% GOOD - wrap in quotes
C --> H["/api/auth/*"]
```

### Common Node Shapes
```mermaid
graph TD
    A[Rectangle]           %% Standard process
    B([Stadium])           %% Start/End
    C{Diamond}             %% Decision
    D[(Database)]          %% Data store
    E((Circle))            %% Connection point
```

### Edge Labels
```mermaid
graph TD
    A -->|"label"| B       %% With label
    A --> B                %% Without label
    A -.-> B               %% Dotted line
    A ==> B                %% Thick line
```

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Auth flows | `auth-*-flow.md` | `auth-jwt-token-flow.md` |
| Data pipelines | `*-pipeline-flow.md` | `rag-pipeline-flow.md` |
| Processing | `*-processing-flow.md` | `document-processing-flow.md` |
| Integration | `*-integration-flow.md` | `graph-rag-neo4j-flow.md` |
| Schema | `*-schema-*.md` | `database-schema-relations.md` |
| Overview | `*-overview.md` | `architecture-overview.md` |

---

## Key Components Format

Always use this exact format for listing components:

```markdown
### Section Name
- **File**: `relative/path/from/root.ts` - Brief description
- **Function**: `functionName()` in `file.ts` - What it does
- **Database**: `table_name` - What data it stores
- **Service**: `ServiceName` - Purpose and responsibility
```

Verify all paths exist before including them.
