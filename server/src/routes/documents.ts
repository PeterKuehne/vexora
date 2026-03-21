/**
 * Document Routes - Upload, list, update, delete documents with permissions
 */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { documentService } from '../services/index.js';
import { authService } from '../services/AuthService.js';
import { processingJobService } from '../services/ProcessingJobService.js';
import { quotaService } from '../services/QuotaService.js';
import { documentEventService } from '../services/DocumentEventService.js';

const router = Router();

// File upload configuration
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 150 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/html',
      'text/markdown',
      'text/plain',
      'application/octet-stream',
    ]
    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.htm', '.md', '.markdown', '.txt']

    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0]

    if (allowedMimeTypes.includes(file.mimetype) || (ext && allowedExtensions.includes(ext))) {
      cb(null, true)
    } else {
      cb(new Error(`Dateiformat nicht unterstützt. Erlaubt: PDF, DOCX, PPTX, XLSX, HTML, MD, TXT`))
    }
  }
})

// Upload document with permissions
router.post('/upload', authenticateToken, upload.single('document'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    throw new ValidationError('Keine Datei hochgeladen', {
      field: 'document',
      details: ['Ein PDF-Dokument ist erforderlich'],
    })
  }

  const fileValidation = documentService.validateFile(req.file)
  if (!fileValidation.valid) {
    throw new ValidationError(fileValidation.error || 'Datei-Validierung fehlgeschlagen', {
      field: 'document',
      details: [fileValidation.error || 'Unbekannter Validierungsfehler'],
    })
  }

  const user = req.user!;
  const quotaValidation = await quotaService.validateUpload(user.user_id, user.role, req.file.size);
  if (!quotaValidation.allowed) {
    throw new ValidationError(quotaValidation.reason || 'Quota-Limit erreicht', {
      field: 'quota',
      details: [quotaValidation.reason || 'Upload würde Speicher-Quota überschreiten'],
      metadata: {
        currentUsage: quotaValidation.currentUsage
      }
    })
  }

  const {
    classification = 'internal',
    visibility = 'department',
    specificUsers = [],
    department
  } = req.body;

  const userRole = req.user?.role || 'Employee';
  const allowedClassifications: Record<string, string[]> = {
    'Employee': ['public', 'internal'],
    'Manager': ['public', 'internal', 'confidential'],
    'Admin': ['public', 'internal', 'confidential', 'restricted']
  };

  if (!allowedClassifications[userRole]?.includes(classification)) {
    throw new ValidationError(`Rolle "${userRole}" kann keine "${classification}" Dokumente erstellen`, {
      field: 'classification',
      details: [`Erlaubte Klassifizierungen für ${userRole}: ${allowedClassifications[userRole]?.join(', ')}`],
    });
  }

  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const job = processingJobService.createJob(
    documentId,
    req.file.filename,
    req.file.originalname,
    {
      ownerId: req.user?.user_id || null,
      department: department || req.user?.department || null,
      classification,
      visibility,
      specificUsers: Array.isArray(specificUsers) ? specificUsers : [],
      allowedRoles: visibility === 'all_users' ? ['Employee', 'Manager', 'Admin'] : null,
      allowedUsers: visibility === 'specific_users' ? specificUsers : null
    }
  )

  await authService.createAuditLog({
    userId: req.user?.user_id,
    userEmail: req.user?.email || 'unknown',
    action: 'document_upload',
    result: 'success',
    resourceType: 'document',
    resourceId: documentId,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    metadata: {
      filename: req.file.originalname,
      size: req.file.size,
      classification,
      visibility,
      department: department || req.user?.department
    }
  });

  res.status(202).json({
    success: true,
    jobId: job.id,
    documentId,
    status: 'pending',
    message: 'Dokument wird verarbeitet. Sie erhalten Updates über den Status.',
    permissions: {
      classification,
      visibility,
      owner: req.user?.name || 'Unbekannt',
      department: department || req.user?.department || null
    }
  })
}))

// Get all documents (RLS-filtered)
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  const documents = await documentService.getAccessibleDocuments()
  await documentService.clearUserContext()

  res.json({
    documents,
    totalCount: documents.length,
  })
}))

// Get all unique tags (BEFORE :id route!)
router.get('/tags', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tags = await documentService.getAllTags()
  res.json({ tags })
}))

// Get document categories (BEFORE :id route!)
router.get('/categories', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { DOCUMENT_CATEGORIES } = await import('../services/DocumentService.js')
  res.json({ categories: DOCUMENT_CATEGORIES })
}))

// Get single document (RLS-filtered)
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  const allAccessibleDocuments = await documentService.getAccessibleDocuments()
  const document = allAccessibleDocuments.find(doc => doc.id === id)
  await documentService.clearUserContext()

  if (!document) {
    res.status(404).json({
      error: 'Dokument nicht gefunden oder nicht autorisiert',
      id,
    })
    return
  }

  res.json({ document })
}))

// Delete document (RLS-filtered)
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  const allAccessibleDocuments = await documentService.getAccessibleDocuments()
  const hasAccess = allAccessibleDocuments.some(doc => doc.id === id)

  if (!hasAccess) {
    await authService.createAuditLog({
      userId: req.user?.user_id,
      userEmail: req.user?.email || 'unknown',
      action: 'document_delete',
      result: 'denied',
      resourceType: 'document',
      resourceId: id,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: { reason: 'Access denied or document not found' }
    });

    await documentService.clearUserContext()

    res.status(404).json({
      error: 'Dokument nicht gefunden oder nicht autorisiert für Löschung',
      id,
    })
    return
  }

  const documentToDelete = allAccessibleDocuments.find(doc => doc.id === id)
  const success = await documentService.deleteDocument(id || '')

  if (success && documentToDelete) {
    documentEventService.emitDocumentDeleted({
      document: {
        id: documentToDelete.id,
        filename: documentToDelete.filename,
        originalName: documentToDelete.originalName || documentToDelete.filename
      },
      deletedBy: req.user?.user_id || 'unknown',
      deletedByEmail: req.user?.email || 'unknown@example.com',
      affectedUsers: [req.user?.user_id || 'unknown']
    })

    await authService.createAuditLog({
      userId: req.user?.user_id,
      userEmail: req.user?.email || 'unknown',
      action: 'document_delete',
      result: 'success',
      resourceType: 'document',
      resourceId: documentToDelete.id,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        filename: documentToDelete.originalName || documentToDelete.filename,
        classification: documentToDelete.metadata?.classification
      }
    });
  }

  await documentService.clearUserContext()

  if (!success) {
    res.status(500).json({
      error: 'Fehler beim Löschen des Dokuments',
      id,
    })
    return
  }

  res.json({
    success: true,
    message: 'Dokument erfolgreich gelöscht',
  })
}))

// Update document (category/tags)
router.patch('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { category, tags } = req.body

  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  const allAccessibleDocuments = await documentService.getAccessibleDocuments()
  const hasAccess = allAccessibleDocuments.some(doc => doc.id === id)

  if (!hasAccess) {
    await documentService.clearUserContext()

    res.status(404).json({
      error: 'Dokument nicht gefunden oder nicht autorisiert für Bearbeitung',
      id,
    })
    return
  }

  const document = await documentService.updateDocument(id || '', { category, tags })
  await documentService.clearUserContext()

  if (!document) {
    res.status(500).json({
      error: 'Fehler beim Aktualisieren des Dokuments',
      id,
    })
    return
  }

  res.json({
    success: true,
    document,
  })
}))

// Update document permissions
router.patch('/:id/permissions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { classification, visibility, specificUsers } = req.body

  if (!classification || !visibility) {
    res.status(400).json({
      error: 'classification and visibility are required',
      code: 'MISSING_REQUIRED_FIELDS'
    })
    return
  }

  const validClassifications = ['public', 'internal', 'confidential', 'restricted']
  if (!validClassifications.includes(classification)) {
    res.status(400).json({
      error: 'Invalid classification value',
      code: 'INVALID_CLASSIFICATION',
      allowedValues: validClassifications
    })
    return
  }

  const validVisibilities = ['only_me', 'department', 'all_users', 'specific_users']
  if (!validVisibilities.includes(visibility)) {
    res.status(400).json({
      error: 'Invalid visibility value',
      code: 'INVALID_VISIBILITY',
      allowedValues: validVisibilities
    })
    return
  }

  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  try {
    const allAccessibleDocuments = await documentService.getAccessibleDocuments()
    const document = allAccessibleDocuments.find(doc => doc.id === id)

    if (!document) {
      await documentService.clearUserContext()
      res.status(404).json({
        error: 'Dokument nicht gefunden oder nicht autorisiert für Bearbeitung',
        code: 'DOCUMENT_NOT_FOUND'
      })
      return
    }

    const isOwner = document.metadata?.owner_id === req.user?.user_id
    const isAdmin = req.user?.role === 'Admin'
    const isManagerForLegacyDoc = req.user?.role === 'Manager' && !document.metadata?.owner_id

    if (!isOwner && !isAdmin && !isManagerForLegacyDoc) {
      await documentService.clearUserContext()
      res.status(403).json({
        error: 'Nur der Dokumentenbesitzer oder Administrator können Berechtigungen ändern',
        code: 'PERMISSION_DENIED'
      })
      return
    }

    const userRole = req.user?.role || ''
    const roleLevel = userRole === 'Admin' ? 3 : userRole === 'Manager' ? 2 : 1

    const classificationLevels: Record<string, number> = {
      'public': 1,
      'internal': 1,
      'confidential': 2,
      'restricted': 3
    }

    const requiredLevel = classificationLevels[classification] || 1

    if (roleLevel < requiredLevel) {
      await documentService.clearUserContext()
      res.status(403).json({
        error: `Ihre Rolle (${userRole}) erlaubt keine ${classification} Klassifizierung`,
        code: 'INSUFFICIENT_ROLE_LEVEL',
        allowedClassifications: Object.keys(classificationLevels).filter(c => (classificationLevels[c] ?? 0) <= roleLevel)
      })
      return
    }

    const updatedDocument = await documentService.updateDocumentPermissions(id!, {
      classification,
      visibility,
      specificUsers: specificUsers || []
    })

    await documentService.clearUserContext()

    if (!updatedDocument) {
      res.status(500).json({
        error: 'Fehler beim Aktualisieren der Dokumentenberechtigungen',
        code: 'UPDATE_FAILED'
      })
      return
    }

    res.json({
      success: true,
      message: 'Dokumentenberechtigungen erfolgreich aktualisiert',
      document: {
        id: updatedDocument.id,
        classification: updatedDocument.metadata?.classification,
        visibility: updatedDocument.metadata?.visibility,
        specificUsers: updatedDocument.metadata?.specificUsers,
        updatedAt: updatedDocument.updatedAt
      }
    })

  } catch (error) {
    await documentService.clearUserContext()
    console.error('Error updating document permissions:', error)
    res.status(500).json({
      error: 'Interner Server-Fehler beim Aktualisieren der Berechtigungen',
      code: 'INTERNAL_SERVER_ERROR'
    })
  }
}))

// Bulk delete documents
router.post('/bulk-delete', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({
      error: 'IDs-Array ist erforderlich',
    })
    return
  }

  const results: { id: string; success: boolean; error?: string }[] = []
  let successCount = 0
  let failCount = 0

  for (const id of ids) {
    try {
      const success = await documentService.deleteDocument(id)
      if (success) {
        results.push({ id, success: true })
        successCount++
      } else {
        results.push({ id, success: false, error: 'Dokument nicht gefunden' })
        failCount++
      }
    } catch (error) {
      results.push({ id, success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' })
      failCount++
    }
  }

  res.json({
    success: failCount === 0,
    message: `${successCount} Dokument(e) gelöscht${failCount > 0 ? `, ${failCount} fehlgeschlagen` : ''}`,
    results,
    deletedCount: successCount,
    failedCount: failCount,
  })
}))

export default router;
