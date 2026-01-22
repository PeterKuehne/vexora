import { EventEmitter } from 'events';

/**
 * DocumentEventService - Manages real-time document events
 * Acts as a bridge between DocumentService and Socket.io
 */
class DocumentEventService extends EventEmitter {
  /**
   * Emit document uploaded event
   */
  emitDocumentUploaded(data: {
    document: {
      id: string;
      filename: string;
      originalName: string;
      category: string;
      tags: string[];
      size: number;
      uploadedBy: string;
      uploadedByEmail: string;
      createdAt: string;
    };
    affectedUsers: string[];
  }): void {
    const event = {
      type: 'document:uploaded' as const,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.emit('document:uploaded', event);
    console.log(`📤 Document uploaded event emitted for: ${data.document.id}`);
  }

  /**
   * Emit document deleted event
   */
  emitDocumentDeleted(data: {
    document: {
      id: string;
      filename: string;
      originalName: string;
    };
    deletedBy: string;
    deletedByEmail: string;
    affectedUsers: string[];
  }): void {
    const event = {
      type: 'document:deleted' as const,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.emit('document:deleted', event);
    console.log(`📤 Document deleted event emitted for: ${data.document.id}`);
  }

  /**
   * Emit document updated event
   */
  emitDocumentUpdated(data: {
    document: {
      id: string;
      filename: string;
      originalName: string;
      category: string;
      tags: string[];
      updatedFields: string[];
    };
    updatedBy: string;
    updatedByEmail: string;
    affectedUsers: string[];
  }): void {
    const event = {
      type: 'document:updated' as const,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.emit('document:updated', event);
    console.log(`📤 Document updated event emitted for: ${data.document.id}`);
  }

  /**
   * Emit document permissions changed event
   */
  emitDocumentPermissionsChanged(data: {
    document: {
      id: string;
      filename: string;
      originalName: string;
      classification: string;
      visibility: string;
      specificUsers: string[];
    };
    changedBy: string;
    changedByEmail: string;
    addedUsers: string[];
    removedUsers: string[];
  }): void {
    const event = {
      type: 'document:permissions_changed' as const,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.emit('document:permissions_changed', event);
    console.log(`📤 Document permissions changed event emitted for: ${data.document.id}`);
  }

  /**
   * Emit bulk delete event
   */
  emitDocumentsBulkDeleted(data: {
    documents: Array<{
      id: string;
      filename: string;
      originalName: string;
    }>;
    deletedBy: string;
    deletedByEmail: string;
    affectedUsers: string[];
  }): void {
    const event = {
      type: 'documents:bulk_deleted' as const,
      ...data,
      timestamp: new Date().toISOString()
    };

    this.emit('documents:bulk_deleted', event);
    console.log(`📤 Documents bulk deleted event emitted for: ${data.documents.length} documents`);
  }
}

export const documentEventService = new DocumentEventService();