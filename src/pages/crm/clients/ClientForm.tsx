import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useClients } from "@/hooks/useClients";
import { useAgents } from "@/hooks/useAgents";
import { useCrmEmails } from "@/hooks/useCrmEmails";
import { useCelebration } from "@/hooks/useCelebration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

const clientSchema = z.object({
  type_adresse: z.enum(["client", "collaborateur", "partenaire"]),
  assigned_agent_id: z.string().optional().nullable(),
  manager_id: z.string().optional().nullable(),
  first_name: z.string().min(1, "Prénom requis").max(100),
  last_name: z.string().min(1, "Nom requis").max(100),
  company_name: z.string().max(200).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  zip_code: z.string().max(20).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  birthdate: z.string().optional().nullable(),
  email: z.string().email("Email invalide").max(255).or(z.literal("")).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  status: z.enum(["prospect", "actif", "résilié", "dormant"]),
  tags: z.array(z.string()).optional().nullable(),
  civil_status: z.enum(["célibataire", "marié", "divorcé", "séparé", "veuf"]).optional().nullable(),
  permit_type: z.enum(["B", "C", "G", "L", "Autre"]).optional().nullable(),
  nationality: z.string().max(100).optional().nullable(),
  profession: z.string().max(200).optional().nullable(),
  employer: z.string().max(200).optional().nullable(),
  iban: z.string().max(34).optional().nullable(),
  bank_name: z.string().max(200).optional().nullable(),
  gender: z.enum(["homme", "femme", "enfant"]).optional().nullable(),
});

type ClientFormData = z.infer<typeof clientSchema>;

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { createClient, updateClient, getClientById } = useClients();
  const { agents, loading: agentsLoading, getManagerForAgent } = useAgents();
  const { sendWelcomeEmail } = useCrmEmails();
  const { celebrate } = useCelebration();
  const [loading, setLoading] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [selectedManager, setSelectedManager] = useState<{ id: string; name: string } | null>(null);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      type_adresse: "client",
      assigned_agent_id: null,
      manager_id: null,
      first_name: "",
      last_name: "",
      company_name: null,
      address: null,
      zip_code: null,
      city: null,
      country: "Suisse",
      birthdate: null,
      email: null,
      mobile: null,
      phone: null,
      status: "prospect",
      tags: [],
      civil_status: null,
      permit_type: null,
      nationality: null,
      profession: null,
      employer: null,
      iban: null,
      bank_name: null,
      gender: null,
    },
  });

  // Watch for agent changes to auto-assign manager
  const watchedAgentId = form.watch("assigned_agent_id");
  
  useEffect(() => {
    if (watchedAgentId && watchedAgentId !== "none") {
      const manager = getManagerForAgent(watchedAgentId);
      if (manager) {
        setSelectedManager({
          id: manager.id,
          name: `${manager.first_name || ''} ${manager.last_name || ''}`.trim() || manager.email || 'Manager'
        });
        form.setValue("manager_id", manager.id);
      } else {
        setSelectedManager(null);
        form.setValue("manager_id", null);
      }
    } else {
      setSelectedManager(null);
      form.setValue("manager_id", null);
    }
  }, [watchedAgentId, agents]);

  useEffect(() => {
    if (id) {
      loadClient();
    }
  }, [id]);

  const loadClient = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await getClientById(id);
    if (data) {
      form.reset({
        type_adresse: (data.type_adresse as any) || "client",
        assigned_agent_id: data.assigned_agent_id,
        manager_id: (data as any).manager_id || null,
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        company_name: data.company_name,
        address: data.address,
        zip_code: data.zip_code,
        city: data.city,
        country: data.country || "Suisse",
        birthdate: data.birthdate,
        email: data.email,
        mobile: data.mobile,
        phone: data.phone,
        status: (data.status as any) || "prospect",
        tags: data.tags || [],
        civil_status: (data.civil_status as any) || null,
        permit_type: (data.permit_type as any) || null,
        nationality: data.nationality,
        profession: data.profession,
        employer: data.employer,
        iban: data.iban,
        bank_name: data.bank_name,
        gender: (data as any).gender || null,
      });
      setTagsInput(data.tags?.join(", ") || "");
    }
    setLoading(false);
  };

  const onSubmit = async (data: ClientFormData) => {
    setLoading(true);
    
    // Parse tags from input
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Clean up field values - convert "none" and empty strings to null
    const cleanedAssignedAgentId = (!data.assigned_agent_id || data.assigned_agent_id === "none" || data.assigned_agent_id === "") 
      ? null 
      : data.assigned_agent_id;
    
    const cleanedManagerId = (!data.manager_id || data.manager_id === "none" || data.manager_id === "") 
      ? null 
      : data.manager_id;

    const clientData = {
      ...data,
      tags,
      assigned_agent_id: cleanedAssignedAgentId,
      manager_id: cleanedManagerId,
      company_name: data.company_name || null,
      address: data.address || null,
      zip_code: data.zip_code || null,
      city: data.city || null,
      country: data.country || "Suisse",
      birthdate: data.birthdate || null,
      email: data.email || null,
      mobile: data.mobile || null,
      phone: data.phone || null,
      civil_status: (data.civil_status as string) === "none" ? null : (data.civil_status || null),
      permit_type: (data.permit_type as string) === "none" ? null : (data.permit_type || null),
      gender: (data.gender as string) === "none" ? null : (data.gender || null),
    };

    if (id) {
      const { error } = await updateClient(id, clientData);
      if (!error) {
        navigate(`/crm/clients/${id}`);
      }
    } else {
      const { data: newClient, error } = await createClient(clientData);
      if (!error && newClient) {
        // Celebrate the new client!
        celebrate('client_added');
        
        // Send welcome email for new clients (not collaborateurs/partenaires)
        if (clientData.type_adresse === "client" && clientData.email) {
          const clientName = `${clientData.first_name} ${clientData.last_name}`.trim();
          sendWelcomeEmail(clientData.email, clientName);
        }
        navigate(`/crm/clients/${newClient.id}`);
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/crm/clients")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {id ? "Modifier l'adresse" : "Nouvelle adresse"}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'adresse</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Section Informations personnelles */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  Informations personnelles
                </h3>

                <FormField
                  control={form.control}
                  name="type_adresse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type d'adresse *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="collaborateur">Collaborateur</SelectItem>
                          <SelectItem value="partenaire">Partenaire</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="civil_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>État civil</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? null : value)
                          }
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Non renseigné</SelectItem>
                            <SelectItem value="célibataire">Célibataire</SelectItem>
                            <SelectItem value="marié">Marié(e)</SelectItem>
                            <SelectItem value="divorcé">Divorcé(e)</SelectItem>
                            <SelectItem value="séparé">Séparé(e)</SelectItem>
                            <SelectItem value="veuf">Veuf(ve)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avatar</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? null : value)
                          }
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Non renseigné</SelectItem>
                            <SelectItem value="homme">Homme</SelectItem>
                            <SelectItem value="femme">Femme</SelectItem>
                            <SelectItem value="enfant">Enfant</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="prospect">Prospect</SelectItem>
                            <SelectItem value="actif">Actif</SelectItem>
                            <SelectItem value="résilié">Résilié</SelectItem>
                            <SelectItem value="dormant">Dormant</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="birthdate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de naissance</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="permit_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de permis</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? null : value)
                          }
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            <SelectItem value="B">Permis B</SelectItem>
                            <SelectItem value="C">Permis C</SelectItem>
                            <SelectItem value="G">Permis G</SelectItem>
                            <SelectItem value="L">Permis L</SelectItem>
                            <SelectItem value="Autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nationality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nationalité</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="profession"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profession</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employeur</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entreprise</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section Coordonnées */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  Coordonnées
                </h3>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="zip_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code postal</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pays</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone fixe</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section Informations bancaires */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  Informations bancaires
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="iban"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IBAN</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="CH93 0000 0000 0000 0000 0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bank_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de la banque</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Section Autres */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  Autres informations
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assigned_agent_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent assigné</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                          value={field.value || "none"}
                          disabled={agentsLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un agent" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.first_name && agent.last_name
                                  ? `${agent.first_name} ${agent.last_name}`
                                  : agent.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Manager automatique */}
                  <div className="space-y-2">
                    <FormLabel>Manager attitré</FormLabel>
                    <div className={`px-3 py-2 rounded-md border ${selectedManager ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-muted'}`}>
                      {selectedManager ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {selectedManager.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {watchedAgentId && watchedAgentId !== "none" 
                            ? "Aucun manager pour cet agent" 
                            : "Sélectionnez un agent"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Assigné automatiquement selon l'agent
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel>Tags (séparés par des virgules)</FormLabel>
                  <Input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="VIP, Entreprise, Lead"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/crm/clients")}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
