import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useClients } from "@/hooks/useClients";
import { useAgents } from "@/hooks/useAgents";
import { useCrmEmails } from "@/hooks/useCrmEmails";
import { useCelebration } from "@/hooks/useCelebration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SwissPostalCodeFields } from "@/components/ui/swiss-postal-code-fields";
import { SwissAddressInput } from "@/components/ui/swiss-address-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, User as UserIcon } from "lucide-react";
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
  is_company: z.boolean().optional().default(false),
  // first_name / last_name sont optionnels au niveau Zod. La validation
  // conditionnelle est faite via 2 refine() en dessous :
  //   - si is_company = false (particulier) → first_name + last_name requis
  //   - si is_company = true (société) → company_name requis, prénom/nom optionnels
  first_name: z.string().max(100).optional().nullable(),
  last_name: z.string().max(100).optional().nullable(),
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
  civil_status: z.enum(["célibataire", "marié", "pacsé", "divorcé", "séparé", "veuf"]).optional().nullable(),
  permit_type: z.enum(["B", "C", "G", "L", "Autre"]).optional().nullable(),
  nationality: z.string().max(100).optional().nullable(),
  profession: z.string().max(200).optional().nullable(),
  employer: z.string().max(200).optional().nullable(),
  iban: z.string().max(34).optional().nullable(),
  bank_name: z.string().max(200).optional().nullable(),
  gender: z.enum(["homme", "femme", "enfant"]).optional().nullable(),

  // ─── Champs entreprise (clients pro) ─────────────────────────────
  // Visibles + persistés uniquement si is_company === true. Servent à
  // pré-remplir automatiquement le mandat de gestion pro (sinon le broker
  // les ressaisit à chaque mandat). Migration DB : 20260608120000.
  ide: z.string().max(20).optional().nullable(),                       // CHE-XXX.XXX.XXX
  rc_canton: z.string().max(2).optional().nullable(),                  // VD, GE, ZH…
  rc_number: z.string().max(50).optional().nullable(),                 // CH-550.1.234.567-8
  legal_rep_first_name: z.string().max(100).optional().nullable(),
  legal_rep_last_name: z.string().max(100).optional().nullable(),
  legal_rep_function: z.string().max(100).optional().nullable(),       // Administrateur, Directeur, Gérant…
  signature_power: z.enum(["individual", "collective_2"]).optional().nullable(),
}).refine(
  // Société = raison sociale obligatoire
  (data) =>
    !data.is_company || (data.company_name != null && data.company_name.trim().length > 0),
  {
    message: "La raison sociale est requise pour un client professionnel",
    path: ["company_name"],
  }
).refine(
  // Particulier (non-société) = prénom obligatoire
  (data) => data.is_company || (data.first_name != null && data.first_name.trim().length > 0),
  {
    message: "Prénom requis",
    path: ["first_name"],
  }
).refine(
  // Particulier (non-société) = nom obligatoire
  (data) => data.is_company || (data.last_name != null && data.last_name.trim().length > 0),
  {
    message: "Nom requis",
    path: ["last_name"],
  }
);

type ClientFormData = z.infer<typeof clientSchema>;

export default function ClientForm() {
  const { t } = useTranslation();
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
      is_company: false,
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
      // Champs entreprise (vides par défaut, remplis si client pro)
      ide: null,
      rc_canton: null,
      rc_number: null,
      legal_rep_first_name: null,
      legal_rep_last_name: null,
      legal_rep_function: null,
      signature_power: "individual",
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
        type_adresse: (data.type_adresse as ClientFormData['type_adresse']) || "client",
        assigned_agent_id: data.assigned_agent?.id || data.assigned_agent_id,
        manager_id: (data as Record<string, unknown>).manager_id as string | null || null,
        is_company: Boolean((data as Record<string, unknown>).is_company),
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
        status: (data.status as ClientFormData['status']) || "prospect",
        tags: data.tags || [],
        civil_status: (data.civil_status as ClientFormData['civil_status']) || null,
        permit_type: (data.permit_type as ClientFormData['permit_type']) || null,
        nationality: data.nationality,
        profession: data.profession,
        employer: data.employer,
        iban: data.iban,
        bank_name: data.bank_name,
        gender: (data as Record<string, unknown>).gender as ClientFormData['gender'] || null,
        // Champs entreprise — pré-remplis si déjà saisis sur ce client
        ide: (data as Record<string, unknown>).ide as string | null || null,
        rc_canton: (data as Record<string, unknown>).rc_canton as string | null || null,
        rc_number: (data as Record<string, unknown>).rc_number as string | null || null,
        legal_rep_first_name: (data as Record<string, unknown>).legal_rep_first_name as string | null || null,
        legal_rep_last_name: (data as Record<string, unknown>).legal_rep_last_name as string | null || null,
        legal_rep_function: (data as Record<string, unknown>).legal_rep_function as string | null || null,
        signature_power: ((data as Record<string, unknown>).signature_power as ClientFormData['signature_power']) || "individual",
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
      // Champs entreprise — persistés uniquement si is_company=true.
      // Pour un particulier on force null pour ne pas garder de résidus
      // de saisie si l'user a basculé pro→privé.
      ide: data.is_company ? (data.ide || null) : null,
      rc_canton: data.is_company ? (data.rc_canton || null) : null,
      rc_number: data.is_company ? (data.rc_number || null) : null,
      legal_rep_first_name: data.is_company ? (data.legal_rep_first_name || null) : null,
      legal_rep_last_name: data.is_company ? (data.legal_rep_last_name || null) : null,
      legal_rep_function: data.is_company ? (data.legal_rep_function || null) : null,
      signature_power: data.is_company ? (data.signature_power || "individual") : null,
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
        
        // Send welcome email for new clients only.
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
            {id ? t('clientForm.editAddress') : t('clientForm.newAddress')}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('clientForm.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Section Informations personnelles */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  {t('clientForm.personalInfo')}
                </h3>

                <FormField
                  control={form.control}
                  name="type_adresse"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('clientForm.addressType')} *</FormLabel>
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
                          <SelectItem value="client">{t('clientForm.client')}</SelectItem>
                          <SelectItem value="collaborateur">{t('clientForm.collaborator')}</SelectItem>
                          <SelectItem value="partenaire">{t('clientForm.partner')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Privé / Professionnel — visible uniquement pour le type "client" */}
                {form.watch("type_adresse") === "client" && (
                  <FormField
                    control={form.control}
                    name="is_company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de client *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value ? "pro" : "prive"}
                            onValueChange={(v) => field.onChange(v === "pro")}
                            className="grid grid-cols-2 gap-3"
                          >
                            <label
                              htmlFor="client-type-prive"
                              className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                                !field.value
                                  ? "border-primary bg-primary/5"
                                  : "border-muted hover:border-primary/40"
                              }`}
                            >
                              <RadioGroupItem id="client-type-prive" value="prive" />
                              <UserIcon className="h-5 w-5 text-primary" />
                              <div className="flex flex-col">
                                <span className="font-medium">Privé</span>
                                <span className="text-xs text-muted-foreground">Personne physique</span>
                              </div>
                            </label>
                            <label
                              htmlFor="client-type-pro"
                              className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                                field.value
                                  ? "border-primary bg-primary/5"
                                  : "border-muted hover:border-primary/40"
                              }`}
                            >
                              <RadioGroupItem id="client-type-pro" value="pro" />
                              <Building2 className="h-5 w-5 text-primary" />
                              <div className="flex flex-col">
                                <span className="font-medium">Professionnel</span>
                                <span className="text-xs text-muted-foreground">Entreprise / société</span>
                              </div>
                            </label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Raison sociale — visible uniquement si client professionnel */}
                {form.watch("type_adresse") === "client" && form.watch("is_company") && (
                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          Raison sociale *
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="Ex : Cabinet Dupont SA"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* ─── Bloc Informations entreprise (juin 2026) ────────────────
                    Visible uniquement si is_company=true. Pré-remplit
                    automatiquement le mandat de gestion pro sans ressaisie. */}
                {form.watch("type_adresse") === "client" && form.watch("is_company") && (
                  <div className="mt-2 mb-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Informations entreprise</span>
                      <span className="text-xs text-muted-foreground">— utilisé pour le mandat de gestion pro</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="ide"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>N° IDE</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="CHE-XXX.XXX.XXX"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="rc_canton"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Canton du Registre du commerce</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                              value={field.value || "none"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">— Non renseigné —</SelectItem>
                                {["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"].map((ct) => (
                                  <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="rc_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>N° d'inscription au RC</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="Ex : CH-550.1.234.567-8"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="signature_power"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pouvoir de signature</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || "individual"}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="individual">Individuel (1 signataire)</SelectItem>
                                <SelectItem value="collective_2">Collectif à deux (2 signataires)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="pt-3 border-t border-primary/20">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Représentant légal (signataire pour l'entreprise)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="legal_rep_first_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prénom</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="legal_rep_last_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="legal_rep_function"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fonction</FormLabel>
                              <Select
                                onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                                value={field.value || "none"}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">— Non renseigné —</SelectItem>
                                  <SelectItem value="Administrateur unique">Administrateur unique</SelectItem>
                                  <SelectItem value="Administrateur président">Administrateur président</SelectItem>
                                  <SelectItem value="Administrateur">Administrateur</SelectItem>
                                  <SelectItem value="Directeur général">Directeur général</SelectItem>
                                  <SelectItem value="Directeur">Directeur</SelectItem>
                                  <SelectItem value="Gérant">Gérant</SelectItem>
                                  <SelectItem value="Gérant unique">Gérant unique</SelectItem>
                                  <SelectItem value="Président">Président</SelectItem>
                                  <SelectItem value="Associé gérant">Associé gérant</SelectItem>
                                  <SelectItem value="Fondé de pouvoir">Fondé de pouvoir</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {form.watch("type_adresse") === "client" && form.watch("is_company") && (
                  <p className="text-sm text-muted-foreground -mt-2">
                    Renseignez ci-dessous la <strong>personne associée</strong> (contact principal de l'entreprise) :
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="civil_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('clientForm.civilStatus')}</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? null : value)
                          }
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('clientForm.notSpecified')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{t('clientForm.notSpecified')}</SelectItem>
                            <SelectItem value="célibataire">{t('clientForm.single')}</SelectItem>
                            <SelectItem value="marié">{t('clientForm.married')}</SelectItem>
                            <SelectItem value="pacsé">{t('clientForm.civilUnion', 'Pacsé(e)')}</SelectItem>
                            <SelectItem value="divorcé">{t('clientForm.divorced')}</SelectItem>
                            <SelectItem value="séparé">{t('clientForm.separated')}</SelectItem>
                            <SelectItem value="veuf">{t('clientForm.widowed')}</SelectItem>
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
                        <FormLabel>{t('clientForm.avatar')}</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? null : value)
                          }
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('clientForm.notSpecified')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{t('clientForm.notSpecified')}</SelectItem>
                            <SelectItem value="homme">{t('clientForm.male')}</SelectItem>
                            <SelectItem value="femme">{t('clientForm.female')}</SelectItem>
                            <SelectItem value="enfant">{t('clientForm.child')}</SelectItem>
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
                        <FormLabel>{t('clientForm.status')} *</FormLabel>
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
                            <SelectItem value="prospect">{t('clientForm.prospect')}</SelectItem>
                            <SelectItem value="actif">{t('clientForm.active')}</SelectItem>
                            <SelectItem value="résilié">{t('clientForm.terminated')}</SelectItem>
                            <SelectItem value="dormant">{t('clientForm.dormant')}</SelectItem>
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
                        <FormLabel>
                          {t('clientForm.firstName')}
                          {form.watch("is_company") ? (
                            <span className="text-xs text-muted-foreground ml-1">(optionnel pour société)</span>
                          ) : (
                            <span> *</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
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
                        <FormLabel>
                          {t('clientForm.lastName')}
                          {form.watch("is_company") ? (
                            <span className="text-xs text-muted-foreground ml-1">(optionnel pour société)</span>
                          ) : (
                            <span> *</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
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
                        <FormLabel>{t('clientForm.birthdate')}</FormLabel>
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
                        <FormLabel>{t('clientForm.permitType')}</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? null : value)
                          }
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('clientForm.notSpecified')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{t('clientForm.none')}</SelectItem>
                            <SelectItem value="B">{t('clientForm.permitB')}</SelectItem>
                            <SelectItem value="C">{t('clientForm.permitC')}</SelectItem>
                            <SelectItem value="G">{t('clientForm.permitG')}</SelectItem>
                            <SelectItem value="L">{t('clientForm.permitL')}</SelectItem>
                            <SelectItem value="Autre">{t('clientForm.other')}</SelectItem>
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
                        <FormLabel>{t('clientForm.nationality')}</FormLabel>
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
                        <FormLabel>{t('clientForm.profession')}</FormLabel>
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
                        <FormLabel>{t('clientForm.employer')}</FormLabel>
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
                        <FormLabel>{t('clients.companyName')}</FormLabel>
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
                  {t('clientForm.contactInfo')}
                </h3>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('clientForm.address')}</FormLabel>
                      <FormControl>
                        {/*
                          Swiss street-address autocomplete via swisstopo.
                          Picking a suggestion auto-fills postal code +
                          city (and the country defaults to Suisse).
                        */}
                        <SwissAddressInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          country={form.watch("country") || ""}
                          onAddressResolved={(r) => {
                            if (r.postalCode) {
                              form.setValue("zip_code", r.postalCode, { shouldDirty: true, shouldTouch: true });
                            }
                            if (r.city) {
                              form.setValue("city", r.city, { shouldDirty: true, shouldTouch: true });
                            }
                            // Si le pays n'est pas encore renseigné, on
                            // initialise à Suisse par défaut (cas du nouveau
                            // client créé from scratch). Si le pays est déjà
                            // renseigné (France, Belgique, etc.), on respecte
                            // le choix du broker.
                            const currentCountry = (form.getValues("country") || "").toString().trim();
                            if (!currentCountry) {
                              form.setValue("country", "Suisse", { shouldDirty: true });
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/*
                    Swiss postal code + city auto-completion via OpenPLZ API.
                    The component drives both `zip_code` and `city` through
                    react-hook-form's setValue, with debounced lookup.
                  */}
                  <SwissPostalCodeFields
                    postalCode={form.watch("zip_code") || ""}
                    city={form.watch("city") || ""}
                    country={form.watch("country") || ""}
                    onPostalCodeChange={(v) =>
                      form.setValue("zip_code", v, { shouldDirty: true, shouldTouch: true })
                    }
                    onCityChange={(v) =>
                      form.setValue("city", v, { shouldDirty: true, shouldTouch: true })
                    }
                    postalCodeLabel={t("clientForm.postalCode")}
                    cityLabel={t("clientForm.city")}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('clientForm.country')}</FormLabel>
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
                        <FormLabel>{t('clientForm.email')}</FormLabel>
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
                        <FormLabel>{t('clientForm.mobile')}</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="79 123 45 67"
                          />
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
                        <FormLabel>{t('clientForm.phone')}</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="22 123 45 67"
                          />
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
                  {t('clientForm.bankInfo')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="iban"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('clientForm.iban')}</FormLabel>
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
                        <FormLabel>{t('clientForm.bankName')}</FormLabel>
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
                  {t('common.details')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assigned_agent_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('clientForm.assignedAgent')}</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                          value={field.value || "none"}
                          disabled={agentsLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('clientForm.noAgent')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{t('clientForm.none')}</SelectItem>
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
                    <FormLabel>{t('clientForm.manager')}</FormLabel>
                    <div className={`px-3 py-2 rounded-md border ${selectedManager ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-muted'}`}>
                      {selectedManager ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {selectedManager.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {watchedAgentId && watchedAgentId !== "none" 
                            ? t('clientForm.noAgent') 
                            : t('clientForm.notSpecified')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('clientForm.autoAssigned')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel>{t('clientForm.tags')}</FormLabel>
                  <Input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder={t('clientForm.tagsHelp')}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? t('clientForm.saving') : t('clientForm.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/crm/clients")}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
