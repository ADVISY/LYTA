import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MessageSquare, CheckCircle, Clock, TrendingUp } from "lucide-react";

export const CampaignStats = () => {
  const { data: emailStats } = useQuery({
    queryKey: ["email-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("status");
      if (error) throw error;
      
      const sent = data?.filter(e => e.status === "sent").length || 0;
      const pending = data?.filter(e => e.status === "pending").length || 0;
      const total = data?.length || 0;
      
      return { sent, pending, total };
    },
  });

  const stats = [
    {
      label: "Emails envoyés",
      value: emailStats?.sent || 0,
      icon: Mail,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "En attente",
      value: emailStats?.pending || 0,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      label: "SMS envoyés",
      value: 0,
      icon: MessageSquare,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Taux de succès",
      value: emailStats?.total ? Math.round((emailStats.sent / emailStats.total) * 100) : 100,
      suffix: "%",
      icon: TrendingUp,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stat.value}{stat.suffix || ""}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
