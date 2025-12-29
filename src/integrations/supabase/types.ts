export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          session_id: string
          updated_at: string
          user_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          updated_at?: string
          user_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
          user_type?: string | null
        }
        Relationships: []
      }
      ai_leads: {
        Row: {
          canton: string | null
          conversation_id: string
          created_at: string
          email: string | null
          id: string
          nom: string | null
          notes: string | null
          prenom: string | null
          situation_familiale: string | null
          status: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          canton?: string | null
          conversation_id: string
          created_at?: string
          email?: string | null
          id?: string
          nom?: string | null
          notes?: string | null
          prenom?: string | null
          situation_familiale?: string | null
          status?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          canton?: string | null
          conversation_id?: string
          created_at?: string
          email?: string | null
          id?: string
          nom?: string | null
          notes?: string | null
          prenom?: string | null
          situation_familiale?: string | null
          status?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          request_count: number | null
          session_id: string
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          request_count?: number | null
          session_id: string
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          request_count?: number | null
          session_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: number
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: number
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      claim_documents: {
        Row: {
          claim_id: string
          created_at: string
          document_id: string
          id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          document_id: string
          id?: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          claim_type: string
          client_id: string
          created_at: string
          description: string
          id: string
          incident_date: string
          policy_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          claim_type: string
          client_id: string
          created_at?: string
          description: string
          id?: string
          incident_date: string
          policy_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          claim_type?: string
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          incident_date?: string
          policy_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          assigned_agent_id: string | null
          bank_name: string | null
          birthdate: string | null
          bonus_rate: number | null
          canton: string | null
          city: string | null
          civil_status: string | null
          commission_rate: number | null
          commission_rate_lca: number | null
          commission_rate_vie: number | null
          company_name: string | null
          contract_type: string | null
          country: string | null
          created_at: string
          email: string | null
          employer: string | null
          external_ref: string | null
          first_name: string | null
          fixed_salary: number | null
          hire_date: string | null
          iban: string | null
          id: string
          is_company: boolean | null
          last_name: string | null
          manager_commission_rate_lca: number | null
          manager_commission_rate_vie: number | null
          manager_id: string | null
          mobile: string | null
          nationality: string | null
          permit_type: string | null
          phone: string | null
          postal_code: string | null
          profession: string | null
          reserve_rate: number | null
          status: string | null
          tags: string[] | null
          tenant_id: string | null
          type_adresse: string
          updated_at: string
          user_id: string | null
          work_percentage: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          assigned_agent_id?: string | null
          bank_name?: string | null
          birthdate?: string | null
          bonus_rate?: number | null
          canton?: string | null
          city?: string | null
          civil_status?: string | null
          commission_rate?: number | null
          commission_rate_lca?: number | null
          commission_rate_vie?: number | null
          company_name?: string | null
          contract_type?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          employer?: string | null
          external_ref?: string | null
          first_name?: string | null
          fixed_salary?: number | null
          hire_date?: string | null
          iban?: string | null
          id?: string
          is_company?: boolean | null
          last_name?: string | null
          manager_commission_rate_lca?: number | null
          manager_commission_rate_vie?: number | null
          manager_id?: string | null
          mobile?: string | null
          nationality?: string | null
          permit_type?: string | null
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          reserve_rate?: number | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          type_adresse?: string
          updated_at?: string
          user_id?: string | null
          work_percentage?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          assigned_agent_id?: string | null
          bank_name?: string | null
          birthdate?: string | null
          bonus_rate?: number | null
          canton?: string | null
          city?: string | null
          civil_status?: string | null
          commission_rate?: number | null
          commission_rate_lca?: number | null
          commission_rate_vie?: number | null
          company_name?: string | null
          contract_type?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          employer?: string | null
          external_ref?: string | null
          first_name?: string | null
          fixed_salary?: number | null
          hire_date?: string | null
          iban?: string | null
          id?: string
          is_company?: boolean | null
          last_name?: string | null
          manager_commission_rate_lca?: number | null
          manager_commission_rate_vie?: number | null
          manager_id?: string | null
          mobile?: string | null
          nationality?: string | null
          permit_type?: string | null
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          reserve_rate?: number | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          type_adresse?: string
          updated_at?: string
          user_id?: string | null
          work_percentage?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_clients_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          collaborator_id: string
          created_at: string
          id: string
          module: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          collaborator_id: string
          created_at?: string
          id?: string
          module: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          collaborator_id?: string
          created_at?: string
          id?: string
          module?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_permissions_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_permissions_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_part_agent: {
        Row: {
          agent_id: string
          amount: number
          commission_id: string
          created_at: string | null
          id: string
          rate: number
        }
        Insert: {
          agent_id: string
          amount: number
          commission_id: string
          created_at?: string | null
          id?: string
          rate: number
        }
        Update: {
          agent_id?: string
          amount?: number
          commission_id?: string
          created_at?: string | null
          id?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_part_agent_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_part_agent_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_part_agent_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          partner_id: string | null
          period_month: number | null
          period_year: number | null
          policy_id: string
          status: string
          tenant_id: string | null
          total_amount: number | null
          type: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          period_month?: number | null
          period_year?: number | null
          policy_id: string
          status?: string
          tenant_id?: string | null
          total_amount?: number | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          period_month?: number | null
          period_year?: number | null
          policy_id?: string
          status?: string
          tenant_id?: string | null
          total_amount?: number | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          canceled_at: string | null
          created_at: string
          id: string
          policy_id: string
          renewal_date: string | null
          signature_provider: string | null
          signature_status: string
          signed_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          id?: string
          policy_id: string
          renewal_date?: string | null
          signature_provider?: string | null
          signature_status?: string
          signed_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          id?: string
          policy_id?: string
          renewal_date?: string | null
          signature_provider?: string | null
          signature_status?: string
          signed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_kind: string | null
          file_key: string
          file_name: string
          id: string
          mime_type: string | null
          owner_id: string
          owner_type: string
          size_bytes: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_kind?: string | null
          file_key: string
          file_name: string
          id?: string
          mime_type?: string | null
          owner_id: string
          owner_type: string
          size_bytes?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_kind?: string | null
          file_key?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          owner_id?: string
          owner_type?: string
          size_bytes?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          birth_date: string | null
          client_id: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          nationality: string | null
          permit_type: string | null
          relation_type: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          client_id: string
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          nationality?: string | null
          permit_type?: string | null
          relation_type: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          client_id?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          nationality?: string | null
          permit_type?: string | null
          relation_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_companies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      insurance_products: {
        Row: {
          category: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "insurance_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          created_at: string
          has_attachments: boolean | null
          id: string
          read_at: string | null
          sender_user_id: string | null
          thread_key: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          has_attachments?: boolean | null
          id?: string
          read_at?: string | null
          sender_user_id?: string | null
          thread_key: string
        }
        Update: {
          body?: string | null
          created_at?: string
          has_attachments?: boolean | null
          id?: string
          read_at?: string | null
          sender_user_id?: string | null
          thread_key?: string
        }
        Relationships: []
      }
      messages_clients: {
        Row: {
          channel: string
          client_id: string
          content: string
          created_at: string | null
          direction: string
          id: string
        }
        Insert: {
          channel: string
          client_id: string
          content: string
          created_at?: string | null
          direction: string
          id?: string
        }
        Update: {
          channel?: string
          client_id?: string
          content?: string
          created_at?: string | null
          direction?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string | null
          payload: Json | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          payload?: Json | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          payload?: Json | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          code: string | null
          created_at: string
          id: string
          manager_partner_id: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          manager_partner_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          manager_partner_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_manager_partner_id_fkey"
            columns: ["manager_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          client_id: string
          company_name: string | null
          created_at: string
          currency: string
          deductible: number | null
          end_date: string | null
          id: string
          notes: string | null
          partner_id: string | null
          policy_number: string | null
          premium_monthly: number | null
          premium_yearly: number | null
          product_id: string
          product_type: string | null
          products_data: Json | null
          start_date: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          company_name?: string | null
          created_at?: string
          currency?: string
          deductible?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          policy_number?: string | null
          premium_monthly?: number | null
          premium_yearly?: number | null
          product_id: string
          product_type?: string | null
          products_data?: Json | null
          start_date: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_name?: string | null
          created_at?: string
          currency?: string
          deductible?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          policy_number?: string | null
          premium_monthly?: number | null
          premium_yearly?: number | null
          product_id?: string
          product_type?: string | null
          products_data?: Json | null
          start_date?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "insurance_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      propositions: {
        Row: {
          agent_id: string | null
          client_id: string
          company_name: string | null
          created_at: string | null
          end_date: string | null
          id: string
          monthly_premium: number | null
          product_type: string | null
          start_date: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          yearly_premium: number | null
        }
        Insert: {
          agent_id?: string | null
          client_id: string
          company_name?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          monthly_premium?: number | null
          product_type?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          yearly_premium?: number | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string
          company_name?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          monthly_premium?: number | null
          product_type?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          yearly_premium?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propositions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propositions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suivis: {
        Row: {
          assigned_agent_id: string | null
          client_id: string
          created_at: string | null
          description: string | null
          id: string
          reminder_date: string | null
          status: string | null
          tenant_id: string | null
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          client_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          reminder_date?: string | null
          status?: string | null
          tenant_id?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          reminder_date?: string | null
          status?: string | null
          tenant_id?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suivis_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suivis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_branding: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_branding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_role_permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          allowed: boolean
          created_at: string
          id: string
          module: Database["public"]["Enums"]["permission_module"]
          role_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          allowed?: boolean
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["permission_module"]
          role_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          allowed?: boolean
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["permission_module"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "tenant_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_roles: {
        Row: {
          can_see_all_commissions: boolean
          can_see_own_commissions: boolean
          can_see_team_commissions: boolean
          created_at: string
          dashboard_scope: Database["public"]["Enums"]["dashboard_scope"]
          description: string | null
          id: string
          is_active: boolean
          is_system_role: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          can_see_all_commissions?: boolean
          can_see_own_commissions?: boolean
          can_see_team_commissions?: boolean
          created_at?: string
          dashboard_scope?: Database["public"]["Enums"]["dashboard_scope"]
          description?: string | null
          id?: string
          is_active?: boolean
          is_system_role?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          can_see_all_commissions?: boolean
          can_see_own_commissions?: boolean
          can_see_team_commissions?: boolean
          created_at?: string
          dashboard_scope?: Database["public"]["Enums"]["dashboard_scope"]
          description?: string | null
          id?: string
          is_active?: boolean
          is_system_role?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_security_settings: {
        Row: {
          created_at: string
          enable_2fa_contract: boolean
          enable_2fa_login: boolean
          id: string
          password_min_length: number
          password_require_number: boolean
          password_require_special: boolean
          password_require_uppercase: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enable_2fa_contract?: boolean
          enable_2fa_login?: boolean
          id?: string
          password_min_length?: number
          password_require_number?: boolean
          password_require_special?: boolean
          password_require_uppercase?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enable_2fa_contract?: boolean
          enable_2fa_login?: boolean
          id?: string
          password_min_length?: number
          password_require_number?: boolean
          password_require_special?: boolean
          password_require_uppercase?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_security_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          created_at: string
          email: string
          id: string
          legal_name: string | null
          name: string
          phone: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          id?: string
          legal_name?: string | null
          name: string
          phone?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          id?: string
          legal_name?: string | null
          name?: string
          phone?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenant_assignments: {
        Row: {
          created_at: string
          id: string
          is_platform_admin: boolean
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_platform_admin?: boolean
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_platform_admin?: boolean
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenant_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tenant_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "tenant_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tenant_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tenant_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      clients_safe: {
        Row: {
          address: string | null
          assigned_agent_id: string | null
          bank_name: string | null
          birthdate: string | null
          bonus_rate: number | null
          canton: string | null
          city: string | null
          civil_status: string | null
          commission_rate: number | null
          commission_rate_lca: number | null
          commission_rate_vie: number | null
          company_name: string | null
          contract_type: string | null
          country: string | null
          created_at: string | null
          email: string | null
          employer: string | null
          external_ref: string | null
          first_name: string | null
          fixed_salary: number | null
          hire_date: string | null
          iban: string | null
          id: string | null
          is_company: boolean | null
          last_name: string | null
          manager_commission_rate_lca: number | null
          manager_commission_rate_vie: number | null
          manager_id: string | null
          mobile: string | null
          nationality: string | null
          permit_type: string | null
          phone: string | null
          postal_code: string | null
          profession: string | null
          reserve_rate: number | null
          status: string | null
          tags: string[] | null
          type_adresse: string | null
          updated_at: string | null
          user_id: string | null
          work_percentage: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          assigned_agent_id?: string | null
          bank_name?: never
          birthdate?: string | null
          bonus_rate?: never
          canton?: string | null
          city?: string | null
          civil_status?: string | null
          commission_rate?: never
          commission_rate_lca?: never
          commission_rate_vie?: never
          company_name?: string | null
          contract_type?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          employer?: string | null
          external_ref?: string | null
          first_name?: string | null
          fixed_salary?: never
          hire_date?: string | null
          iban?: never
          id?: string | null
          is_company?: boolean | null
          last_name?: string | null
          manager_commission_rate_lca?: never
          manager_commission_rate_vie?: never
          manager_id?: string | null
          mobile?: string | null
          nationality?: string | null
          permit_type?: string | null
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          reserve_rate?: never
          status?: string | null
          tags?: string[] | null
          type_adresse?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_percentage?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          assigned_agent_id?: string | null
          bank_name?: never
          birthdate?: string | null
          bonus_rate?: never
          canton?: string | null
          city?: string | null
          civil_status?: string | null
          commission_rate?: never
          commission_rate_lca?: never
          commission_rate_vie?: never
          company_name?: string | null
          contract_type?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          employer?: string | null
          external_ref?: string | null
          first_name?: string | null
          fixed_salary?: never
          hire_date?: string | null
          iban?: never
          id?: string | null
          is_company?: boolean | null
          last_name?: string | null
          manager_commission_rate_lca?: never
          manager_commission_rate_vie?: never
          manager_id?: string | null
          mobile?: string | null
          nationality?: string | null
          permit_type?: string | null
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          reserve_rate?: never
          status?: string | null
          tags?: string[] | null
          type_adresse?: string | null
          updated_at?: string | null
          user_id?: string | null
          work_percentage?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_clients_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_client: { Args: { client_id: string }; Returns: boolean }
      can_see_commissions_scope: { Args: never; Returns: string }
      can_view_financial_data: { Args: never; Returns: boolean }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      create_audit_log: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: number
      }
      get_partner_policies: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_partner_id: string
          p_status?: string
        }
        Returns: {
          client_id: string
          client_name: string
          company_name: string
          created_at: string
          end_date: string
          id: string
          policy_number: string
          premium_monthly: number
          premium_yearly: number
          product_id: string
          product_name: string
          start_date: string
          status: string
        }[]
      }
      get_user_dashboard_scope: {
        Args: never
        Returns: Database["public"]["Enums"]["dashboard_scope"]
      }
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _module: Database["public"]["Enums"]["permission_module"]
        }
        Returns: boolean
      }
      is_king: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "client"
        | "partner"
        | "manager"
        | "agent"
        | "backoffice"
        | "compta"
        | "king"
      dashboard_scope: "personal" | "team" | "global"
      permission_action:
        | "view"
        | "create"
        | "update"
        | "delete"
        | "export"
        | "deposit"
        | "cancel"
        | "generate"
        | "validate"
        | "modify_rules"
      permission_module:
        | "clients"
        | "contracts"
        | "partners"
        | "products"
        | "collaborators"
        | "commissions"
        | "decomptes"
        | "payout"
        | "dashboard"
        | "settings"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "client",
        "partner",
        "manager",
        "agent",
        "backoffice",
        "compta",
        "king",
      ],
      dashboard_scope: ["personal", "team", "global"],
      permission_action: [
        "view",
        "create",
        "update",
        "delete",
        "export",
        "deposit",
        "cancel",
        "generate",
        "validate",
        "modify_rules",
      ],
      permission_module: [
        "clients",
        "contracts",
        "partners",
        "products",
        "collaborators",
        "commissions",
        "decomptes",
        "payout",
        "dashboard",
        "settings",
      ],
    },
  },
} as const
