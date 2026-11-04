// Generado por npm run db:types. No editar a mano.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activities": {
                  Row: {
                    "author_id": string | null,"body": string,"contact_id": string,"created_at": string,"id": string,"kind": string,"metadata": NonNullable<Json>,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body"?: string,"contact_id": string,"created_at"?: string,"id"?: string,"kind": string,"metadata"?: NonNullable<Json>,"organization_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"contact_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"metadata"?: NonNullable<Json>,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_organization_id_contact_id_fkey"
      columns: ["organization_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "activities_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "assigned_user_id": string | null,"contact_id": string,"created_at": string,"created_by": string | null,"duration_minutes": number,"id": string,"notes": string,"organization_id": string,"property_id": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_user_id"?: string | null,"contact_id": string,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number,"id"?: string,"notes"?: string,"organization_id": string,"property_id": string,"starts_at": string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Update: {
                    "assigned_user_id"?: string | null,"contact_id"?: string,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number,"id"?: string,"notes"?: string,"organization_id"?: string,"property_id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["appointment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_organization_id_assigned_user_id_fkey"
      columns: ["organization_id","assigned_user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "appointments_organization_id_contact_id_fkey"
      columns: ["organization_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "appointments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_organization_id_property_id_fkey"
      columns: ["organization_id","property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"audit_logs": {
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
                },"client_search_locations": {
                  Row: {
                    "id": string,"name": string,"organization_id": string,"search_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"organization_id": string,"search_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"organization_id"?: string,"search_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_search_locations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_search_locations_organization_id_search_id_fkey"
      columns: ["organization_id","search_id"]
isOneToOne: false
      referencedRelation: "client_searches"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"client_searches": {
                  Row: {
                    "assigned_user_id": string | null,"budget_max": number | null,"budget_min": number | null,"budget_tolerance_pct": number,"contact_id": string,"created_at": string,"created_by": string | null,"currency": string,"desired_features": (string)[],"id": string,"min_bedrooms": number | null,"min_rooms": number | null,"notes": string,"operation": Database["public"]['Enums']["property_operation"],"organization_id": string,"property_types": (Database["public"]['Enums']["property_type"])[],"required_features": (string)[],"stage_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_user_id"?: string | null,"budget_max"?: number | null,"budget_min"?: number | null,"budget_tolerance_pct"?: number,"contact_id": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"desired_features"?: (string)[],"id"?: string,"min_bedrooms"?: number | null,"min_rooms"?: number | null,"notes"?: string,"operation": Database["public"]['Enums']["property_operation"],"organization_id": string,"property_types": (Database["public"]['Enums']["property_type"])[],"required_features"?: (string)[],"stage_id": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_user_id"?: string | null,"budget_max"?: number | null,"budget_min"?: number | null,"budget_tolerance_pct"?: number,"contact_id"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"desired_features"?: (string)[],"id"?: string,"min_bedrooms"?: number | null,"min_rooms"?: number | null,"notes"?: string,"operation"?: Database["public"]['Enums']["property_operation"],"organization_id"?: string,"property_types"?: (Database["public"]['Enums']["property_type"])[],"required_features"?: (string)[],"stage_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_searches_organization_id_assigned_user_id_fkey"
      columns: ["organization_id","assigned_user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "client_searches_organization_id_contact_id_fkey"
      columns: ["organization_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "client_searches_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_searches_organization_id_stage_id_fkey"
      columns: ["organization_id","stage_id"]
isOneToOne: false
      referencedRelation: "pipeline_stages"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"contact_emails": {
                  Row: {
                    "contact_id": string,"created_at": string,"email": string,"id": string,"label": string | null,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_id": string,"created_at"?: string,"email": string,"id"?: string,"label"?: string | null,"organization_id": string
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"email"?: string,"id"?: string,"label"?: string | null,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_emails_organization_id_contact_id_fkey"
      columns: ["organization_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "contact_emails_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_phones": {
                  Row: {
                    "contact_id": string,"created_at": string,"id": string,"is_whatsapp": boolean,"label": string | null,"organization_id": string,"phone_e164": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_id": string,"created_at"?: string,"id"?: string,"is_whatsapp"?: boolean,"label"?: string | null,"organization_id": string,"phone_e164": string
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"id"?: string,"is_whatsapp"?: boolean,"label"?: string | null,"organization_id"?: string,"phone_e164"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_phones_organization_id_contact_id_fkey"
      columns: ["organization_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "contact_phones_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "assigned_user_id": string | null,"created_at": string,"created_by": string | null,"do_not_contact": boolean,"do_not_contact_at": string | null,"full_name": string,"id": string,"is_owner": boolean,"is_prospect": boolean,"merged_at": string | null,"merged_into_id": string | null,"notes": string,"organization_id": string,"source": Database["public"]['Enums']["contact_source"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_user_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"do_not_contact"?: boolean,"do_not_contact_at"?: string | null,"full_name": string,"id"?: string,"is_owner"?: boolean,"is_prospect"?: boolean,"merged_at"?: string | null,"merged_into_id"?: string | null,"notes"?: string,"organization_id": string,"source"?: Database["public"]['Enums']["contact_source"],"updated_at"?: string
                  }
                  Update: {
                    "assigned_user_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"do_not_contact"?: boolean,"do_not_contact_at"?: string | null,"full_name"?: string,"id"?: string,"is_owner"?: boolean,"is_prospect"?: boolean,"merged_at"?: string | null,"merged_into_id"?: string | null,"notes"?: string,"organization_id"?: string,"source"?: Database["public"]['Enums']["contact_source"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_organization_id_assigned_user_id_fkey"
      columns: ["organization_id","assigned_user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "contacts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_organization_id_merged_into_id_fkey"
      columns: ["organization_id","merged_into_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"duplicate_reports": {
                  Row: {
                    "contact_a_id": string,"contact_b_id": string,"created_at": string,"id": string,"organization_id": string,"reason": string,"reported_by": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["duplicate_report_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_a_id": string,"contact_b_id": string,"created_at"?: string,"id"?: string,"organization_id": string,"reason"?: string,"reported_by"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["duplicate_report_status"]
                  }
                  Update: {
                    "contact_a_id"?: string,"contact_b_id"?: string,"created_at"?: string,"id"?: string,"organization_id"?: string,"reason"?: string,"reported_by"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["duplicate_report_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "duplicate_reports_organization_id_contact_a_id_fkey"
      columns: ["organization_id","contact_a_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "duplicate_reports_organization_id_contact_b_id_fkey"
      columns: ["organization_id","contact_b_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "duplicate_reports_organization_id_fkey"
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
                    "accepted_at": string,"document_is_draft": boolean,"id": string,"legal_document_id": string,"organization_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"document_is_draft"?: boolean,"id"?: string,"legal_document_id": string,"organization_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "accepted_at"?: string,"document_is_draft"?: boolean,"id"?: string,"legal_document_id"?: string,"organization_id"?: string | null,"user_id"?: string
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
                    "content": string,"created_at": string,"id": string,"is_draft": boolean,"kind": Database["public"]['Enums']["legal_document_kind"],"published_at": string | null,"title": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"id"?: string,"is_draft"?: boolean,"kind": Database["public"]['Enums']["legal_document_kind"],"published_at"?: string | null,"title": string,"version": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"id"?: string,"is_draft"?: boolean,"kind"?: Database["public"]['Enums']["legal_document_kind"],"published_at"?: string | null,"title"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"match_results": {
                  Row: {
                    "algorithm_version": number,"created_at": string,"desired_met": number,"desired_total": number,"exchange_rate": number | null,"id": string,"missing_features": (string)[],"organization_id": string,"over_budget": boolean,"property_id": string,"score": number,"search_id": string,"stale": boolean,"status": Database["public"]['Enums']["match_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "algorithm_version"?: number,"created_at"?: string,"desired_met": number,"desired_total": number,"exchange_rate"?: number | null,"id"?: string,"missing_features"?: (string)[],"organization_id": string,"over_budget"?: boolean,"property_id": string,"score": number,"search_id": string,"stale"?: boolean,"status"?: Database["public"]['Enums']["match_status"],"updated_at"?: string
                  }
                  Update: {
                    "algorithm_version"?: number,"created_at"?: string,"desired_met"?: number,"desired_total"?: number,"exchange_rate"?: number | null,"id"?: string,"missing_features"?: (string)[],"organization_id"?: string,"over_budget"?: boolean,"property_id"?: string,"score"?: number,"search_id"?: string,"stale"?: boolean,"status"?: Database["public"]['Enums']["match_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_results_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_results_organization_id_property_id_fkey"
      columns: ["organization_id","property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "match_results_organization_id_search_id_fkey"
      columns: ["organization_id","search_id"]
isOneToOne: false
      referencedRelation: "client_searches"
      referencedColumns: ["organization_id","id"]
    }
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
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"dedupe_key": string,"id": string,"kind": string,"link": string | null,"organization_id": string,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"created_at"?: string,"dedupe_key": string,"id"?: string,"kind": string,"link"?: string | null,"organization_id": string,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"dedupe_key"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"organization_id"?: string,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_progress": {
                  Row: {
                    "completed_at": string | null,"organization_id": string,"skipped_at": string | null,"step": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"organization_id": string,"skipped_at"?: string | null,"step": string,"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"organization_id"?: string,"skipped_at"?: string | null,"step"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_progress_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_slug_history": {
                  Row: {
                    "organization_id": string | null,"retired_at": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "organization_id"?: string | null,"retired_at"?: string,"slug": string
                  }
                  Update: {
                    "organization_id"?: string | null,"retired_at"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_slug_history_organization_id_fkey"
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
                },"payment_reports": {
                  Row: {
                    "amount": number,"created_at": string,"currency": string,"id": string,"months": number,"organization_id": string,"plan_code": string,"receipt_path": string | null,"reference": string,"reported_by": string | null,"review_note": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["payment_report_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"currency"?: string,"id"?: string,"months"?: number,"organization_id": string,"plan_code": string,"receipt_path"?: string | null,"reference"?: string,"reported_by"?: string | null,"review_note"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["payment_report_status"]
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"months"?: number,"organization_id"?: string,"plan_code"?: string,"receipt_path"?: string | null,"reference"?: string,"reported_by"?: string | null,"review_note"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["payment_report_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_reports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_reports_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                },"pipeline_stages": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["stage_kind"],"name": string,"organization_id": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["stage_kind"],"name": string,"organization_id": string,"position": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["stage_kind"],"name"?: string,"organization_id"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pipeline_stages_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
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
                    "allow_draft_legal_documents": boolean,"current_privacy_id": string | null,"current_terms_id": string | null,"id": boolean,"payment_instructions": string,"signup_max_organizations_per_user": number,"signup_window_hours": number,"trial_plan_code": string,"updated_at": string,"updated_by": string | null,"version": number,"wa_auto_daily_limit": number,"wa_auto_hourly_limit": number,"wa_auto_min_interval_seconds": number,"wa_auto_window_end": string | null,"wa_auto_window_start": string | null,"wa_max_retries": number
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_draft_legal_documents"?: boolean,"current_privacy_id"?: string | null,"current_terms_id"?: string | null,"id"?: boolean,"payment_instructions"?: string,"signup_max_organizations_per_user"?: number,"signup_window_hours"?: number,"trial_plan_code"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"wa_auto_daily_limit"?: number,"wa_auto_hourly_limit"?: number,"wa_auto_min_interval_seconds"?: number,"wa_auto_window_end"?: string | null,"wa_auto_window_start"?: string | null,"wa_max_retries"?: number
                  }
                  Update: {
                    "allow_draft_legal_documents"?: boolean,"current_privacy_id"?: string | null,"current_terms_id"?: string | null,"id"?: boolean,"payment_instructions"?: string,"signup_max_organizations_per_user"?: number,"signup_window_hours"?: number,"trial_plan_code"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number,"wa_auto_daily_limit"?: number,"wa_auto_hourly_limit"?: number,"wa_auto_min_interval_seconds"?: number,"wa_auto_window_end"?: string | null,"wa_auto_window_start"?: string | null,"wa_max_retries"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_current_privacy_id_fkey"
      columns: ["current_privacy_id"]
isOneToOne: false
      referencedRelation: "legal_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "platform_settings_current_terms_id_fkey"
      columns: ["current_terms_id"]
isOneToOne: false
      referencedRelation: "legal_documents"
      referencedColumns: ["id"]
    },{
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
                },"properties": {
                  Row: {
                    "address": string,"assigned_user_id": string | null,"bathrooms": number | null,"bedrooms": number | null,"city": string,"code": string | null,"covered_area_m2": number | null,"created_at": string,"created_by": string | null,"currency": string,"description": string,"expenses": number | null,"expenses_currency": string,"features": (string)[],"id": string,"merged_at": string | null,"merged_into_id": string | null,"neighborhood": string,"operation": Database["public"]['Enums']["property_operation"],"organization_id": string,"price": number | null,"property_type": Database["public"]['Enums']["property_type"],"province": string,"published_at": string | null,"rooms": number | null,"seq": number,"show_address": boolean,"slug": string,"status": Database["public"]['Enums']["property_status"],"title": string,"total_area_m2": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"assigned_user_id"?: string | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"city"?: string,"code"?: never,"covered_area_m2"?: number | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string,"expenses"?: number | null,"expenses_currency"?: string,"features"?: (string)[],"id"?: string,"merged_at"?: string | null,"merged_into_id"?: string | null,"neighborhood"?: string,"operation": Database["public"]['Enums']["property_operation"],"organization_id": string,"price"?: number | null,"property_type": Database["public"]['Enums']["property_type"],"province"?: string,"published_at"?: string | null,"rooms"?: number | null,"seq"?: number,"show_address"?: boolean,"slug"?: string,"status"?: Database["public"]['Enums']["property_status"],"title": string,"total_area_m2"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string,"assigned_user_id"?: string | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"city"?: string,"code"?: never,"covered_area_m2"?: number | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string,"expenses"?: number | null,"expenses_currency"?: string,"features"?: (string)[],"id"?: string,"merged_at"?: string | null,"merged_into_id"?: string | null,"neighborhood"?: string,"operation"?: Database["public"]['Enums']["property_operation"],"organization_id"?: string,"price"?: number | null,"property_type"?: Database["public"]['Enums']["property_type"],"province"?: string,"published_at"?: string | null,"rooms"?: number | null,"seq"?: number,"show_address"?: boolean,"slug"?: string,"status"?: Database["public"]['Enums']["property_status"],"title"?: string,"total_area_m2"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "properties_organization_id_assigned_user_id_fkey"
      columns: ["organization_id","assigned_user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "properties_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "properties_organization_id_merged_into_id_fkey"
      columns: ["organization_id","merged_into_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"property_changes": {
                  Row: {
                    "author_id": string | null,"created_at": string,"field": string,"id": string,"new_value": Json | null,"old_value": Json | null,"organization_id": string,"property_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"field": string,"id"?: string,"new_value"?: Json | null,"old_value"?: Json | null,"organization_id": string,"property_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"field"?: string,"id"?: string,"new_value"?: Json | null,"old_value"?: Json | null,"organization_id"?: string,"property_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_changes_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "property_changes_organization_id_property_id_fkey"
      columns: ["organization_id","property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"property_images": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"position": number,"property_id": string,"storage_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"position"?: number,"property_id": string,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"position"?: number,"property_id"?: string,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_images_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "property_images_organization_id_property_id_fkey"
      columns: ["organization_id","property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"property_owners": {
                  Row: {
                    "contact_id": string,"created_at": string,"organization_id": string,"property_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_id": string,"created_at"?: string,"organization_id": string,"property_id": string
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"organization_id"?: string,"property_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_owners_organization_id_contact_id_fkey"
      columns: ["organization_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "property_owners_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "property_owners_organization_id_property_id_fkey"
      columns: ["organization_id","property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["organization_id","id"]
    }
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
                },"stage_changes": {
                  Row: {
                    "author_id": string | null,"created_at": string,"from_stage_id": string | null,"id": string,"organization_id": string,"search_id": string,"to_stage_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"from_stage_id"?: string | null,"id"?: string,"organization_id": string,"search_id": string,"to_stage_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"from_stage_id"?: string | null,"id"?: string,"organization_id"?: string,"search_id"?: string,"to_stage_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_changes_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_changes_organization_id_search_id_fkey"
      columns: ["organization_id","search_id"]
isOneToOne: false
      referencedRelation: "client_searches"
      referencedColumns: ["organization_id","id"]
    }
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
                },"tasks": {
                  Row: {
                    "assigned_user_id": string | null,"completed_at": string | null,"contact_id": string | null,"created_at": string,"created_by": string | null,"due_at": string,"id": string,"notes": string,"organization_id": string,"priority": Database["public"]['Enums']["task_priority"],"property_id": string | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_user_id"?: string | null,"completed_at"?: string | null,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_at": string,"id"?: string,"notes"?: string,"organization_id": string,"priority"?: Database["public"]['Enums']["task_priority"],"property_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_user_id"?: string | null,"completed_at"?: string | null,"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_at"?: string,"id"?: string,"notes"?: string,"organization_id"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"property_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_organization_id_assigned_user_id_fkey"
      columns: ["organization_id","assigned_user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "tasks_organization_id_contact_id_fkey"
      columns: ["organization_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tasks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_organization_id_property_id_fkey"
      columns: ["organization_id","property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"approve_payment":
{ Args: { "p_note"?: string,"p_report_id": string }; Returns: undefined
                           },
"claim_jobs":
{ Args: { "p_limit"?: number,"p_lock_timeout_seconds"?: number,"p_worker_id": string }; Returns: {
              "attempts": number,"id": string,"max_attempts": number,"organization_id": string,"payload": Json,"type": string
            }[]
                           },
"complete_job":
{ Args: { "p_job_id": string,"p_worker_id": string }; Returns: boolean
                           },
"create_contact":
{ Args: { "p_assigned_user_id"?: string,"p_emails"?: (string)[],"p_full_name": string,"p_is_owner"?: boolean,"p_is_prospect"?: boolean,"p_notes"?: string,"p_organization_id": string,"p_phones"?: (string)[],"p_source"?: Database["public"]['Enums']["contact_source"] }; Returns: string
                           },
"create_organization":
{ Args: { "p_legal_document_ids": (string)[],"p_name": string,"p_slug_base": string }; Returns: string
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
"invitation_preview":
{ Args: { "p_token": string }; Returns: {
              "email": string,"expires_at": string,"organization_name": string,"role": Database["public"]['Enums']["member_role"],"status": string
            }[]
                           },
"log_import":
{ Args: { "p_imported": number,"p_kind": string,"p_organization_id": string,"p_rejected": number }; Returns: undefined
                           },
"merge_contacts":
{ Args: { "p_keep_id": string,"p_merge_id": string }; Returns: string
                           },
"merge_properties":
{ Args: { "p_keep_id": string,"p_merge_id": string }; Returns: string
                           },
"move_search_stage":
{ Args: { "p_search_id": string,"p_stage_id": string }; Returns: undefined
                           },
"my_organizations":
{ Args: Record<PropertyKey, never>; Returns: {
              "name": string,"organization_id": string,"role": Database["public"]['Enums']["member_role"],"slug": string,"state": Database["public"]['Enums']["account_state"]
            }[]
                           },
"organization_members":
{ Args: { "p_organization_id": string }; Returns: {
              "created_at": string,"email": string,"full_name": string,"membership_id": string,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["membership_status"],"user_id": string
            }[]
                           },
"organization_usage":
{ Args: { "p_organization_id": string }; Returns: {
              "properties_limit": number,"properties_used": number,"users_limit": number,"users_used": number,"whatsapp_limit": number
            }[]
                           },
"payment_instructions":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pipeline_metrics":
{ Args: { "p_organization_id": string }; Returns: {
              "assigned_user_id": string,"stage_id": string,"total": number
            }[]
                           },
"platform_organizations":
{ Args: Record<PropertyKey, never>; Returns: {
              "contacts_count": number,"created_at": string,"id": string,"name": string,"owner_email": string,"paid_until": string,"pending_payments": number,"plan_code": string,"properties_count": number,"slug": string,"state": Database["public"]['Enums']["account_state"],"suspended_at": string,"trial_ends_at": string,"users_count": number
            }[]
                           },
"property_duplicate_candidates":
{ Args: { "p_address": string,"p_exclude_id"?: string,"p_operation": Database["public"]['Enums']["property_operation"],"p_organization_id": string,"p_owner_ids"?: (string)[],"p_property_type": Database["public"]['Enums']["property_type"] }; Returns: {
              "code": string,"id": string,"reason": string,"title": string
            }[]
                           },
"public_property":
{ Args: { "p_organization_slug": string,"p_property_slug": string }; Returns: {
              "address": string,"bathrooms": number,"bedrooms": number,"city": string,"code": string,"covered_area_m2": number,"currency": string,"description": string,"expenses": number,"expenses_currency": string,"features": (string)[],"images": (string)[],"neighborhood": string,"operation": Database["public"]['Enums']["property_operation"],"organization_email": string,"organization_logo_path": string,"organization_name": string,"organization_phone": string,"price": number,"property_type": Database["public"]['Enums']["property_type"],"province": string,"rooms": number,"status": Database["public"]['Enums']["property_status"],"title": string,"total_area_m2": number
            }[]
                           },
"registration_legal_documents":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"is_draft": boolean,"kind": Database["public"]['Enums']["legal_document_kind"],"title": string,"version": string
            }[]
                           },
"reject_payment":
{ Args: { "p_note"?: string,"p_report_id": string }; Returns: undefined
                           },
"resolve_organization_slug":
{ Args: { "p_slug": string }; Returns: string
                           },
"save_client_search":
{ Args: { "p_assigned_user_id": string,"p_budget_max": number,"p_budget_min": number,"p_budget_tolerance_pct": number,"p_contact_id": string,"p_currency": string,"p_desired_features": (string)[],"p_id": string,"p_locations": (string)[],"p_min_bedrooms": number,"p_min_rooms": number,"p_notes": string,"p_operation": Database["public"]['Enums']["property_operation"],"p_organization_id": string,"p_property_types": (Database["public"]['Enums']["property_type"])[],"p_required_features": (string)[] }; Returns: string
                           },
"start_support_session":
{ Args: { "p_organization_id": string }; Returns: string
                           },
"sync_my_reminders":
{ Args: { "p_organization_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_state": "trial"|"active"|"read_only"|"blocked"|"pending_deletion","appointment_status": "scheduled"|"done"|"cancelled"|"no_show","audit_scope": "organization"|"platform","contact_source": "manual"|"whatsapp"|"import","duplicate_report_status": "open"|"merged"|"dismissed","job_status": "pending"|"running"|"succeeded"|"failed"|"cancelled","legal_document_kind": "terms"|"privacy","match_status": "new"|"seen"|"sent"|"dismissed","member_role": "owner"|"agent"|"admin"|"supervisor"|"staff","membership_status": "active"|"deactivated","payment_report_status": "pending"|"approved"|"rejected","property_operation": "sale"|"rent"|"temporary_rent","property_status": "draft"|"available"|"reserved"|"sold"|"rented"|"paused","property_type": "apartment"|"house"|"ph"|"land"|"office"|"commercial"|"garage"|"warehouse"|"farm","stage_kind": "open"|"won"|"lost","task_priority": "low"|"normal"|"high","task_status": "pending"|"done"|"cancelled"
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
            "account_state": ["trial", "active", "read_only", "blocked", "pending_deletion"],"appointment_status": ["scheduled", "done", "cancelled", "no_show"],"audit_scope": ["organization", "platform"],"contact_source": ["manual", "whatsapp", "import"],"duplicate_report_status": ["open", "merged", "dismissed"],"job_status": ["pending", "running", "succeeded", "failed", "cancelled"],"legal_document_kind": ["terms", "privacy"],"match_status": ["new", "seen", "sent", "dismissed"],"member_role": ["owner", "agent", "admin", "supervisor", "staff"],"membership_status": ["active", "deactivated"],"payment_report_status": ["pending", "approved", "rejected"],"property_operation": ["sale", "rent", "temporary_rent"],"property_status": ["draft", "available", "reserved", "sold", "rented", "paused"],"property_type": ["apartment", "house", "ph", "land", "office", "commercial", "garage", "warehouse", "farm"],"stage_kind": ["open", "won", "lost"],"task_priority": ["low", "normal", "high"],"task_status": ["pending", "done", "cancelled"]
          }
        }
} as const
