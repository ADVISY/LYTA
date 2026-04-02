import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth, AuthError } from "../_shared/auth.ts";
import { checkKingIpWhitelist, IpWhitelistError } from "../_shared/ip-whitelist.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("export-tenant-data");

interface ExportRequest {
  tenant_id: string;
  format?: "csv" | "json";
  tables?: string[];
}

// Helper to convert array of objects to CSV
function arrayToCSV(data: any[], tableName: string): string {
  if (!data || data.length === 0) {
    return `# ${tableName} - No data\n`;
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    `# ${tableName}`,
    headers.join(";"),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "object") return JSON.stringify(value).replace(/"/g, '""');
        const strValue = String(value);
        // Escape quotes and wrap in quotes if contains separator or quotes
        if (strValue.includes(";") || strValue.includes('"') || strValue.includes("\n")) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(";")
    )
  ];
  
  return csvRows.join("\n") + "\n\n";
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify caller identity via shared auth
    const { user } = await requireAuth(req);
    await checkKingIpWhitelist(req);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user is king
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "king")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: King role required" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const body: ExportRequest = await req.json();
    const { tenant_id, format = "csv" } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    log.info("Exporting data for tenant", { tenantName: tenant.name, tenantId: tenant_id });

    // Fetch all data
    const [
      clientsResult,
      policiesResult,
      commissionsResult,
      commissionPartsResult,
      documentsResult,
      suivisResult,
      claimsResult,
      familyMembersResult,
      decomptesResult,
    ] = await Promise.all([
      supabaseAdmin.from("clients").select("*").eq("tenant_id", tenant_id),
      supabaseAdmin.from("policies").select("*").eq("tenant_id", tenant_id),
      supabaseAdmin.from("commissions").select("*").eq("tenant_id", tenant_id),
      supabaseAdmin.from("commission_parts").select("*").eq("tenant_id", tenant_id),
      supabaseAdmin.from("documents").select("*").eq("tenant_id", tenant_id),
      supabaseAdmin.from("suivis").select("*").eq("tenant_id", tenant_id),
      supabaseAdmin.from("claims").select("*").eq("tenant_id", tenant_id),
      supabaseAdmin.from("family_members").select("*").eq("tenant_id", tenant_id),
      supabaseAdmin.from("decomptes").select("*").eq("tenant_id", tenant_id),
    ]);

    // Log and track failed queries
    const queryResults = [
      { name: "clients", result: clientsResult },
      { name: "policies", result: policiesResult },
      { name: "commissions", result: commissionsResult },
      { name: "commission_parts", result: commissionPartsResult },
      { name: "documents", result: documentsResult },
      { name: "suivis", result: suivisResult },
      { name: "claims", result: claimsResult },
      { name: "family_members", result: familyMembersResult },
      { name: "decomptes", result: decomptesResult },
    ];

    const failedQueries: string[] = [];
    for (const q of queryResults) {
      if (q.result.error) {
        log.error(`Query failed for table "${q.name}"`, { error: q.result.error });
        failedQueries.push(q.name);
      }
    }

    if (failedQueries.length > 0) {
      log.warn(`${failedQueries.length} queries failed during export`, { failedQueries });
    }

    const exportData = {
      tenant: tenant,
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      ...(failedQueries.length > 0 ? { warnings: [`Failed to export tables: ${failedQueries.join(", ")}`] } : {}),
      data: {
        clients: clientsResult.data || [],
        policies: policiesResult.data || [],
        commissions: commissionsResult.data || [],
        commission_parts: commissionPartsResult.data || [],
        documents: documentsResult.data || [],
        suivis: suivisResult.data || [],
        claims: claimsResult.data || [],
        family_members: familyMembersResult.data || [],
        decomptes: decomptesResult.data || [],
      },
      counts: {
        clients: clientsResult.data?.length || 0,
        policies: policiesResult.data?.length || 0,
        commissions: commissionsResult.data?.length || 0,
        commission_parts: commissionPartsResult.data?.length || 0,
        documents: documentsResult.data?.length || 0,
        suivis: suivisResult.data?.length || 0,
        claims: claimsResult.data?.length || 0,
        family_members: familyMembersResult.data?.length || 0,
        decomptes: decomptesResult.data?.length || 0,
      }
    };

    // Log the export action
    await supabaseAdmin.from("king_audit_logs").insert({
      user_id: user.id,
      action: "export_tenant_data",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      details: {
        format,
        counts: exportData.counts
      }
    });

    if (format === "json") {
      return new Response(
        JSON.stringify(exportData, null, 2),
        { 
          headers: { 
            ...getCorsHeaders(req), 
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${tenant.slug}-export-${new Date().toISOString().split('T')[0]}.json"`
          } 
        }
      );
    }

    // CSV format
    let csvContent = `# Export ${tenant.name} (${tenant.slug})\n`;
    csvContent += `# Date: ${new Date().toISOString()}\n`;
    csvContent += `# Exporté par: ${user.email}\n\n`;

    csvContent += arrayToCSV(exportData.data.clients, "CLIENTS");
    csvContent += arrayToCSV(exportData.data.policies, "POLICES");
    csvContent += arrayToCSV(exportData.data.commissions, "COMMISSIONS");
    csvContent += arrayToCSV(exportData.data.commission_parts, "PARTS_COMMISSIONS");
    csvContent += arrayToCSV(exportData.data.documents, "DOCUMENTS");
    csvContent += arrayToCSV(exportData.data.suivis, "SUIVIS");
    csvContent += arrayToCSV(exportData.data.claims, "RECLAMATIONS");
    csvContent += arrayToCSV(exportData.data.family_members, "MEMBRES_FAMILLE");
    csvContent += arrayToCSV(exportData.data.decomptes, "DECOMPTES");

    // Summary
    csvContent += "# RESUME\n";
    csvContent += "Table;Nombre\n";
    Object.entries(exportData.counts).forEach(([table, count]) => {
      csvContent += `${table};${count}\n`;
    });

    return new Response(csvContent, { 
      headers: { 
        ...getCorsHeaders(req), 
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tenant.slug}-export-${new Date().toISOString().split('T')[0]}.csv"`
      } 
    });

  } catch (error: any) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    if (error instanceof IpWhitelistError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    log.error("Export tenant error", { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
