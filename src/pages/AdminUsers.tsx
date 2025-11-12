import { AdminUserManagement } from "@/components/crm/AdminUserManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function AdminUsers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
          Administration
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Gérez les utilisateurs et leurs rôles d'accès
        </p>
      </div>
      
      <AdminUserManagement />
    </div>
  );
}
