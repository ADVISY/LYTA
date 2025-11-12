import { supabase } from "@/integrations/supabase/client";

// TODO API: REST-style functions pour les documents

export interface DocumentFilters {
  ownerType?: 'client' | 'policy' | 'contract' | 'partner';
  ownerId?: string;
  kind?: string;
  q?: string;
}

export interface UploadDocumentInput {
  file: File;
  ownerType: 'client' | 'policy' | 'contract' | 'partner';
  ownerId: string;
  docKind?: string;
}

// GET /api/partner/documents
export async function getDocuments(
  filters?: DocumentFilters,
  page = 1,
  limit = 25
) {
  let query = supabase
    .from('documents')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.ownerType) {
    query = query.eq('owner_type', filters.ownerType);
  }
  if (filters?.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }
  if (filters?.kind) {
    query = query.eq('doc_kind', filters.kind);
  }
  if (filters?.q) {
    query = query.ilike('file_name', `%${filters.q}%`);
  }

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: data || [],
    page,
    limit,
    total: count || 0,
  };
}

// POST /api/partner/documents (upload)
export async function uploadDocument(input: UploadDocumentInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  // TODO: Implement actual file upload to Supabase Storage
  // For now, we'll create a mock file_key
  const fileKey = `${input.ownerType}/${input.ownerId}/${Date.now()}_${input.file.name}`;

  const { data, error } = await supabase
    .from('documents')
    .insert({
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      file_name: input.file.name,
      file_key: fileKey,
      mime_type: input.file.type,
      size_bytes: input.file.size,
      doc_kind: input.docKind,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.rpc('create_audit_log', {
    p_user_id: user.id,
    p_action: 'UPLOAD_DOCUMENT',
    p_entity: 'document',
    p_entity_id: data.id,
    p_metadata: {
      file_name: input.file.name,
      owner_type: input.ownerType,
      owner_id: input.ownerId,
    },
  });

  return data;
}

// GET /api/partner/documents/:id/download
export async function getDocumentDownloadUrl(documentId: string) {
  const { data: document, error } = await supabase
    .from('documents')
    .select('file_key, file_name')
    .eq('id', documentId)
    .single();

  if (error) throw error;

  // TODO: Generate pre-signed URL for S3/Storage
  // For now, return mock URL
  return {
    url: `#download-${document.file_key}`,
    fileName: document.file_name,
  };
}

// PATCH /api/partner/documents/:id
export async function updateDocument(
  documentId: string,
  updates: {
    doc_kind?: string;
    file_name?: string;
  }
) {
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.rpc('create_audit_log', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_action: 'UPDATE_DOCUMENT',
    p_entity: 'document',
    p_entity_id: documentId,
    p_metadata: updates,
  });

  return data;
}

// DELETE /api/partner/documents/:id
export async function deleteDocument(documentId: string) {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (error) throw error;

  // Create audit log
  await supabase.rpc('create_audit_log', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_action: 'DELETE_DOCUMENT',
    p_entity: 'document',
    p_entity_id: documentId,
  });
}

// Helper: Get documents by policy
export async function getPolicyDocuments(policyId: string) {
  return getDocuments({
    ownerType: 'policy',
    ownerId: policyId,
  });
}

// Helper: Get documents by client
export async function getClientDocuments(clientId: string) {
  return getDocuments({
    ownerType: 'client',
    ownerId: clientId,
  });
}
