// Generado por npm run db:types. No editar a mano.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": string,"metadata": NonNullable<Json>,"organization_id": string | null,"scope": Database["public"]['Enums']["audit_scope"],"via_support_session": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: string,"metadata"?: NonNullable<Json>,"organization_id"?: string | null,"scope": Database["public"]['Enums']["audit_scope"],"via_support_session"?: boolean
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"organization_id"?: string | null,"scope"?: Database["public"]['Enums']["audit_scope"],"via_support_session"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_organization_fk"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"organization_id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id": string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token_hash": string,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"organization_id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token_hash"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"completed_at": string | null,"created_at": string,"id": string,"idempotency_key": string | null,"last_error": string | null,"locked_at": string | null,"locked_by": string | null,"max_attempts": number,"organization_id": string | null,"payload": NonNullable<Json>,"run_after": string,"status": Database["public"]['Enums']["job_status"],"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key"?: string | null,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"organization_id"?: string | null,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: Database["public"]['Enums']["job_status"],"type": string,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"completed_at"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key"?: string | null,"last_error"?: string | null,"locked_at"?: string | null,"locked_by"?: string | null,"max_attempts"?: number,"organization_id"?: string | null,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: Database["public"]['Enums']["job_status"],"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"legal_acceptances": {
                  Row: {
                    "accepted_at": string,"id": string,"legal_document_id": string,"organization_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"id"?: string,"legal_document_id": string,"organization_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "accepted_at"?: string,"id"?: string,"legal_document_id"?: string,"organization_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "legal_acceptances_legal_document_id_fkey"
      columns: ["legal_document_id"]
isOneToOne: false
      referencedRelation: "legal_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "legal_acceptances_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"legal_documents": {
                  Row: {
                    "content": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["legal_document_kind"],"published_at": string | null,"title": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["legal_document_kind"],"published_at"?: string | null,"title": string,"version": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["legal_document_kind"],"published_at"?: string | null,"title"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"deactivated_at": string | null,"id": string,"organization_id": string,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["membership_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deactivated_at"?: string | null,"id"?: string,"organization_id": string,"role": Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["membership_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"deactivated_at"?: string | null,"id"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["membership_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "agents_can_reassign": boolean,"contact_email": string | null,"contact_phone": string | null,"created_at": string,"created_by": string | null,"default_currency": string,"deleted_at": string | null,"id": string,"logo_path": string | null,"name": string,"paid_until": string | null,"plan_code": string,"slug": string,"suspended_at": string | null,"trial_ends_at": string,"updated_at": string,"usd_ars_rate": number | null,"usd_ars_rate_enabled": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "agents_can_reassign"?: boolean,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_currency"?: string,"deleted_at"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"paid_until"?: string | null,"plan_code": string,"slug": string,"suspended_at"?: string | null,"trial_ends_at": string,"updated_at"?: string,"usd_ars_rate"?: number | null,"usd_ars_rate_enabled"?: boolean
                  }
                  Update: {
                    "agents_can_reassign"?: boolean,"contact_email"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_currency"?: string,"deleted_at"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"paid_until"?: string | null,"plan_code"?: string,"slug"?: string,"suspended_at"?: string | null,"trial_ends_at"?: string,"updated_at"?: string,"usd_ars_rate"?: number | null,"usd_ars_rate_enabled"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"plans": {
                  Row: {
                    "code": string,"created_at": string,"includes_automations": boolean,"is_active": boolean,"max_properties": number,"max_users": number,"max_whatsapp_numbers": number | null,"name": string,"reference_price_usd": number,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"includes_automations": boolean,"is_active"?: boolean,"max_properties": number,"max_users": number,"max_whatsapp_numbers"?: number | null,"name": string,"reference_price_usd": number,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"includes_automations"?: boolean,"is_active"?: boolean,"max_properties"?: number,"max_users"?: number,"max_whatsapp_numbers"?: number | null,"name"?: string,"reference_price_usd"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"is_principal": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_principal"?: boolean,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"is_principal"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_settings": {
                  Row: {
                    "id": boolean,"signup_max_organizations_per_user": number,"signup_window_hours": number,"trial_plan_code": string,"updated_at": string,"updated_by": string | null,"version": number,"wa_auto_daily_limit": number,"wa_auto_hourly_limit": number,"wa_auto_min_interval_seconds": number,"wa_auto_window_end": string | null,"wa_auto_window_start": string | null,"wa_max_retries": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: boolean,"signup_max_organizations_per_user"?: number,"signup_window_hours"?: number,"trial_plan_code"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"wa_auto_daily_limit"?: number,"wa_auto_hourly_limit"?: number,"wa_auto_min_interval_seconds"?: number,"wa_auto_window_end"?: string | null,"wa_auto_window_start"?: string | null,"wa_max_retries"?: number
                  }
                  Update: {
                    "id"?: boolean,"signup_max_organizations_per_user"?: number,"signup_window_hours"?: number,"trial_plan_code"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"wa_auto_daily_limit"?: number,"wa_auto_hourly_limit"?: number,"wa_auto_min_interval_seconds"?: number,"wa_auto_window_end"?: string | null,"wa_auto_window_start"?: string | null,"wa_max_retries"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_trial_plan_code_fkey"
      columns: ["trial_plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"full_name": string,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"support_sessions": {
                  Row: {
                    "ended_at": string | null,"id": string,"organization_id": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ended_at"?: string | null,"id"?: string,"organization_id": string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "ended_at"?: string | null,"id"?: string,"organization_id"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_sessions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "platform_admins"
      referencedColumns: ["user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_jobs":
{ Args: { "p_limit"?: number,"p_lock_timeout_seconds"?: number,"p_worker_id": string }; Returns: {
              "attempts": number,"id": string,"max_attempts": number,"organization_id": string,"payload": Json,"type": string
            }[]
                           },
"complete_job":
{ Args: { "p_job_id": string,"p_worker_id": string }; Returns: boolean
                           },
"current_support_organization":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"end_support_session":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"enqueue_job":
{ Args: { "p_idempotency_key"?: string,"p_max_attempts"?: number,"p_organization_id"?: string,"p_payload"?: Json,"p_run_after"?: string,"p_type": string }; Returns: string
                           },
"fail_job":
{ Args: { "p_error": string,"p_job_id": string,"p_retry_delay_seconds"?: number,"p_worker_id": string }; Returns: Database["public"]['Enums']["job_status"]
                           },
"health":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"my_organizations":
{ Args: Record<PropertyKey, never>; Returns: {
              "name": string,"organization_id": string,"role": Database["public"]['Enums']["member_role"],"slug": string,"state": Database["public"]['Enums']["account_state"]
            }[]
                           },
"start_support_session":
{ Args: { "p_organization_id": string }; Returns: string
                           }
          }
          Enums: {
            "account_state": "trial"|"active"|"read_only"|"blocked"|"pending_deletion","audit_scope": "organization"|"platform","job_status": "pending"|"running"|"succeeded"|"failed"|"cancelled","legal_document_kind": "terms"|"privacy","member_role": "owner"|"agent"|"admin"|"supervisor"|"staff","membership_status": "active"|"deactivated"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "account_state": ["trial", "active", "read_only", "blocked", "pending_deletion"],"audit_scope": ["organization", "platform"],"job_status": ["pending", "running", "succeeded", "failed", "cancelled"],"legal_document_kind": ["terms", "privacy"],"member_role": ["owner", "agent", "admin", "supervisor", "staff"],"membership_status": ["active", "deactivated"]
          }
        }
} as const
