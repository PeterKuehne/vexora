# Document Permissions Flow

## Overview
Complete document permission lifecycle for Cor7ex, covering classification-based access control, visibility settings, PostgreSQL Row-Level Security (RLS) enforcement, permission-aware document queries, permission editing by owners/admins, and integration with RAG search filtering.

## Trigger Points
- User uploads a document with classification and visibility settings
- User edits document permissions via PermissionEditDialog
- Any document query (list, detail, delete, search) triggers RLS evaluation
- RAG search filters results by user-accessible documents
- Admin manages documents across all departments

## Flow Diagram

### Document Upload with Permissions
```mermaid
graph TD
    A([User uploads document]) --> B["POST /api/documents/upload"]
    B --> C[authenticateToken middleware]
    C --> D{Auth valid?}
    D -->|No| E["401 Unauthorized"]
    D -->|Yes| F[Multer file handling]

    F --> G[DocumentService.validateFile]
    G --> H{File valid?}
    H -->|No| I["400 Validation error"]
    H -->|Yes| J[QuotaService.validateUpload]

    J --> K{Quota OK?}
    K -->|No| L["400 Quota exceeded"]
    K -->|Yes| M["Extract permission metadata<br/>from request body"]

    M --> N{Role allows<br/>classification?}
    N --> N1["Employee: public, internal"]
    N --> N2["Manager: + confidential"]
    N --> N3["Admin: + restricted"]

    N1 --> O{Classification<br/>allowed?}
    N2 --> O
    N3 --> O
    O -->|No| P["400 Role cannot create<br/>this classification"]
    O -->|Yes| Q["Create processing job<br/>with permission metadata"]

    Q --> R["ProcessingJobService.createJob"]
    R --> R1["ownerId = JWT user_id"]
    R --> R2["department = user department"]
    R --> R3["classification = request value"]
    R --> R4["visibility = request value"]
    R --> R5["allowedRoles / allowedUsers"]

    R1 --> S["Audit log: document_upload"]
    R2 --> S
    R3 --> S
    R4 --> S
    R5 --> S

    S --> T["PostgreSQL INSERT documents<br/>with permission columns"]
    T --> T1["owner_id = user UUID"]
    T --> T2["department = user department"]
    T --> T3["classification = public/internal/confidential/restricted"]
    T --> T4["visibility = only_me/department/all_users/specific_users"]
    T --> T5["allowed_roles = role array"]
    T --> T6["allowed_users = user UUID array"]

    T1 --> U(["Return 202 with jobId + permissions summary"])
    T2 --> U
    T3 --> U
    T4 --> U
    T5 --> U
    T6 --> U
```

### Permission Editing Flow
```mermaid
graph TD
    A([User clicks edit permissions]) --> B[PermissionEditDialog opens]
    B --> C{User authorized?}
    C --> C1["Owner: document.owner_id == user.id"]
    C --> C2["Admin: user.role == Admin"]
    C --> C3["Manager fallback: legacy docs without owner_id"]

    C1 --> D{Can edit?}
    C2 --> D
    C3 --> D
    D -->|No| E["Dialog shows read-only view"]
    D -->|Yes| F["Show editable form"]

    F --> G[ClassificationDropdown]
    G --> G1["Options filtered by user role"]
    G1 --> G2["Employee: public, internal"]
    G1 --> G3["Manager: + confidential"]
    G1 --> G4["Admin: + restricted"]

    F --> H[VisibilitySelector]
    H --> H1["only_me: Owner only"]
    H --> H2["department: Same department"]
    H --> H3["all_users: All authenticated"]
    H --> H4["specific_users: Named users"]

    F --> I[PermissionPreview]
    I --> I1["Live preview of effective access"]

    G --> J([User clicks Save])
    H --> J
    J --> K["PATCH /api/documents/:id/permissions"]

    K --> L[authenticateToken middleware]
    L --> M["Set RLS context:<br/>setUserContext"]
    M --> N{Document accessible?}
    N -->|No| O["404 Not found"]
    N -->|Yes| P{Permission check}

    P --> P1["isOwner: owner_id == user_id"]
    P --> P2["isAdmin: role == Admin"]
    P --> P3["isManagerForLegacy: Manager + no owner"]
    P1 --> Q{Authorized?}
    P2 --> Q
    P3 --> Q
    Q -->|No| R["403 Permission denied"]

    Q -->|Yes| S{Role allows<br/>new classification?}
    S -->|No| T["403 Insufficient role level"]
    S -->|Yes| U["DocumentService.updateDocumentPermissions"]
    U --> V["UPDATE documents SET<br/>classification, visibility, allowed_users"]
    V --> W["clearUserContext"]
    W --> X(["Return updated permissions"])
```

### RLS-Based Document Access (Query Time)
```mermaid
graph TD
    A([Any document query]) --> B{Query type?}
    B -->|GET /api/documents| C["List all documents"]
    B -->|GET /api/documents/:id| D["Get single document"]
    B -->|DELETE /api/documents/:id| E["Delete document"]
    B -->|RAG search| F["Permission-aware search"]

    C --> G["setUserContext(userId, role, department)"]
    D --> G
    E --> G
    F --> G

    G --> H["PostgreSQL set_user_context()"]
    H --> I["SET app.user_id, app.user_role, app.user_department"]

    I --> J{SQL query with RLS}

    J --> K["6 RLS Policies Evaluated (OR logic)"]
    K --> K1["documents_public_policy<br/>classification = public"]
    K --> K2["documents_department_policy<br/>department match + internal/public"]
    K --> K3["documents_owner_policy<br/>owner_id = app.user_id"]
    K --> K4["documents_role_policy<br/>user role in allowed_roles"]
    K --> K5["documents_user_policy<br/>user_id in allowed_users"]
    K --> K6["documents_admin_policy<br/>role = Admin (full access)"]

    K1 --> L{Any policy<br/>grants access?}
    K2 --> L
    K3 --> L
    K4 --> L
    K5 --> L
    K6 --> L

    L -->|Yes| M["Row included in results"]
    L -->|No| N["Row filtered out silently"]

    M --> O["clearUserContext()"]
    N --> O
    O --> P(["Return filtered results"])
```

### RAG Permission Integration
```mermaid
graph TD
    A([RAG-enabled chat request]) --> B{userContext<br/>available?}
    B -->|No| C["Search all documents<br/>(not recommended)"]
    B -->|Yes| D["setUserContext for RLS"]

    D --> E["getAccessibleDocumentIds()"]
    E --> F["SELECT id FROM documents<br/>WHERE status = completed<br/>(RLS filters automatically)"]

    F --> G{Documents found?}
    G -->|No| H["Return no-permission message:<br/>Keine Berechtigung"]
    G -->|Yes| I["Pass allowedDocumentIds to search"]

    I --> J{V2 Search?}
    J -->|Yes| K["VectorServiceV2.search<br/>with allowedDocumentIds filter"]
    J -->|No| L["VectorService.search<br/>with allowedDocumentIds filter"]

    K --> M["Weaviate filters:<br/>documentId IN allowedDocumentIds"]
    L --> M

    M --> N["Results only contain<br/>permitted documents"]
    N --> O(["RAG response with<br/>permission-filtered sources"])
```

## Key Components

### Frontend - Permission UI
- **File**: `src/components/PermissionEditDialog.tsx` - Modal for editing document classification, visibility, and specific user access; checks owner/admin authorization before allowing edits
- **File**: `src/components/ClassificationDropdown.tsx` - Dropdown with 4 classification levels (public, internal, confidential, restricted); filters options by user role
- **File**: `src/components/VisibilitySelector.tsx` - Radio selector with 4 visibility types (only_me, department, all_users, specific_users)
- **File**: `src/components/PermissionPreview.tsx` - Live preview of effective permissions based on selected classification and visibility
- **File**: `src/components/DocumentUploadWithPermissions.tsx` - Upload component with integrated permission settings (classification + visibility)

### Frontend - Context and State
- **File**: `src/contexts/AuthContext.tsx` - Provides user role, department, and ID for permission checks
- **File**: `src/contexts/DocumentContext.tsx` - Document list state with permission metadata per document

### Backend - Document Service
- **File**: `server/src/services/DocumentService.ts` - Core document service with RLS integration
- **Function**: `setUserContext()` in `DocumentService.ts` - Calls PostgreSQL `set_user_context(userId, role, department)` to configure RLS session variables
- **Function**: `getAccessibleDocumentIds()` in `DocumentService.ts` - Returns document IDs filtered by RLS policies (used by RAG search)
- **Function**: `getAccessibleDocuments()` in `DocumentService.ts` - Returns full document metadata filtered by RLS (used by document list/detail)
- **Function**: `updateDocumentPermissions()` in `DocumentService.ts` - Updates classification, visibility, and allowed_users columns
- **Function**: `clearUserContext()` in `DocumentService.ts` - Resets RLS session variables to NULL after query

### Backend - API Endpoints
- **File**: `server/src/index.ts` - Express server with document endpoints
- **Route**: `POST /api/documents/upload` - Upload with classification and visibility metadata, role-based classification validation
- **Route**: `GET /api/documents` - List documents filtered by RLS
- **Route**: `GET /api/documents/:id` - Get single document filtered by RLS
- **Route**: `DELETE /api/documents/:id` - Delete document with RLS access check + audit logging
- **Route**: `PATCH /api/documents/:id/permissions` - Edit permissions (owner/admin only), role-based classification validation
- **Route**: `POST /api/documents/bulk-delete` - Bulk delete with RLS filtering

### Backend - RAG Integration
- **File**: `server/src/services/RAGService.ts` - RAG service that filters search by user-accessible documents
- **Function**: `generateResponse()` in `RAGService.ts` - Sets RLS context, gets accessible document IDs, passes them to vector search
- **Function**: `generateStreamingResponse()` in `RAGService.ts` - Streaming variant with same permission filtering

### Backend - Quota Service
- **File**: `server/src/services/QuotaService.ts` - Per-user storage quota validation before upload

### Database - RLS Policies
- **File**: `server/src/migrations/001_enterprise_auth_setup.sql` - Creates 6 RLS policies and set_user_context function
- **Database**: `documents` table - RLS-enabled with owner_id, department, classification, allowed_roles, allowed_users columns

### Database - PostgreSQL Function
- **Function**: `set_user_context(UUID, VARCHAR, VARCHAR)` - Sets `app.user_id`, `app.user_role`, `app.user_department` session variables for RLS evaluation

## Data Flow

1. **Input (Upload)**: Permission metadata in upload request
   ```typescript
   // Form data:
   {
     file: File,
     classification: 'public' | 'internal' | 'confidential' | 'restricted',
     visibility: 'only_me' | 'department' | 'all_users' | 'specific_users',
     specificUsers: string[],   // User IDs (only for specific_users visibility)
     department?: string,       // Override (defaults to JWT user department)
   }
   // Derived from JWT:
   {
     ownerId: string,           // user_id from JWT
     userRole: 'Employee' | 'Manager' | 'Admin',
     userDepartment: string,
   }
   ```

2. **Storage**: Permission columns in PostgreSQL `documents` table
   ```typescript
   {
     owner_id: UUID,                // Document owner (from JWT)
     department: string,            // Owner's department
     classification: string,        // public | internal | confidential | restricted
     visibility: string,            // only_me | department | all_users | specific_users
     allowed_roles: string[],       // ['Employee', 'Manager', 'Admin'] or null
     allowed_users: UUID[],         // Specific user IDs or null
   }
   ```

3. **RLS Evaluation**: 6 policies evaluated with OR logic
   - Public: `classification = 'public'` (visible to all)
   - Department: `department = app.user_department AND classification IN ('internal', 'public')`
   - Owner: `owner_id = app.user_id` (full CRUD)
   - Role: `app.user_role = ANY(allowed_roles)`
   - User: `app.user_id = ANY(allowed_users)`
   - Admin: `app.user_role = 'Admin'` (full CRUD, all documents)

4. **Permission Edit Input**:
   ```typescript
   // PATCH /api/documents/:id/permissions
   {
     classification: 'public' | 'internal' | 'confidential' | 'restricted',
     visibility: 'only_me' | 'department' | 'all_users' | 'specific_users',
     specificUsers: string[],
   }
   ```

5. **Role-Classification Matrix**:
   ```
   Employee -> can set: public, internal
   Manager  -> can set: public, internal, confidential
   Admin    -> can set: public, internal, confidential, restricted
   ```

6. **Output**: Permission-filtered results
   ```typescript
   // Document list response:
   {
     documents: DocumentMetadata[],  // Only RLS-permitted documents
     totalCount: number,
   }
   // RAG search response:
   {
     sources: RAGSource[],           // Only from permitted documents
     hasRelevantSources: boolean,
   }
   ```

## Error Scenarios
- User attempts to upload with classification above their role level (400 with allowed classifications)
- User attempts to edit permissions on a document they don't own (403 Permission denied)
- Manager attempts to set restricted classification (403 Insufficient role level)
- RLS context not set before document query (returns no results silently - not an error)
- User has no accessible documents for RAG search (returns German-language no-permission message)
- PostgreSQL connection failure during set_user_context (500 error, query fails)
- Document owner deleted but document remains (Admin-only access until reassigned)
- Legacy documents without owner_id (Manager/Admin can edit as fallback)
- Bulk delete includes documents user cannot access (silently skips inaccessible documents)

## Dependencies
- **PostgreSQL** `:5432` - Row-Level Security (RLS) with 6 policies on `documents` table, `set_user_context()` function
- **Express.js** - HTTP routing with `authenticateToken` middleware providing JWT-based user context
- **Weaviate** `:8080` - Vector search filtered by `allowedDocumentIds` parameter (documents pre-filtered by RLS)
- **React** - Frontend permission components (ClassificationDropdown, VisibilitySelector, PermissionPreview, PermissionEditDialog)

---

Last Updated: 2026-02-06
