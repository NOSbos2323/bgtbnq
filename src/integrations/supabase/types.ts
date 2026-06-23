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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      deposits: {
        Row: {
          admin_note: string | null
          amount_dzd: number
          amount_usd: number
          created_at: string
          exchange_rate: number
          id: string
          receipt_path: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_dzd: number
          amount_usd: number
          created_at?: string
          exchange_rate: number
          id?: string
          receipt_path: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_dzd?: number
          amount_usd?: number
          created_at?: string
          exchange_rate?: number
          id?: string
          receipt_path?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          user_id?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          amount_usd: number
          approved_at: string | null
          created_at: string
          id: string
          installment_count: number
          interest_rate: number
          remaining_balance: number
          status: Database["public"]["Enums"]["loan_status"]
          total_repayment: number
          user_id: string
        }
        Insert: {
          amount_usd: number
          approved_at?: string | null
          created_at?: string
          id?: string
          installment_count?: number
          interest_rate?: number
          remaining_balance: number
          status?: Database["public"]["Enums"]["loan_status"]
          total_repayment: number
          user_id: string
        }
        Update: {
          amount_usd?: number
          approved_at?: string | null
          created_at?: string
          id?: string
          installment_count?: number
          interest_rate?: number
          remaining_balance?: number
          status?: Database["public"]["Enums"]["loan_status"]
          total_repayment?: number
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin_account: boolean
          language: string
          phone: string | null
          referral_code: string
          referred_by: string | null
          rib: string | null
          updated_at: string
          verification_note: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_admin_account?: boolean
          language?: string
          phone?: string | null
          referral_code: string
          referred_by?: string | null
          rib?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin_account?: boolean
          language?: string
          phone?: string | null
          referral_code?: string
          referred_by?: string | null
          rib?: string | null
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          bonus_amount_usd: number
          bonus_paid: boolean
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          bonus_amount_usd?: number
          bonus_paid?: boolean
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          bonus_amount_usd?: number
          bonus_paid?: boolean
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_usd: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount_usd: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount_usd?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          note: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          note?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          note?: string | null
          recipient_id?: string
          sender_id?: string
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
        Relationships: []
      }
      verification_requests: {
        Row: {
          admin_note: string | null
          balance_at_request_usd: number
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          balance_at_request_usd?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          balance_at_request_usd?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      virtual_cards: {
        Row: {
          balance_usd: number
          card_number_last4: string
          card_number_masked: string
          cardholder_name: string
          created_at: string
          cvv_encrypted: string
          expiry_month: number
          expiry_year: number
          id: string
          status: Database["public"]["Enums"]["card_status"]
          user_id: string
        }
        Insert: {
          balance_usd?: number
          card_number_last4: string
          card_number_masked: string
          cardholder_name: string
          created_at?: string
          cvv_encrypted: string
          expiry_month: number
          expiry_year: number
          id?: string
          status?: Database["public"]["Enums"]["card_status"]
          user_id: string
        }
        Update: {
          balance_usd?: number
          card_number_last4?: string
          card_number_masked?: string
          cardholder_name?: string
          created_at?: string
          cvv_encrypted?: string
          expiry_month?: number
          expiry_year?: number
          id?: string
          status?: Database["public"]["Enums"]["card_status"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_usd: number
          created_at: string
          frozen_balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_usd?: number
          created_at?: string
          frozen_balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_usd?: number
          created_at?: string
          frozen_balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_wallet: {
        Args: { _delta: number; _reason?: string; _user_id: string }
        Returns: number
      }
      admin_update_user_rib: {
        Args: { _rib: string; _user_id: string }
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin_account: boolean
          language: string
          phone: string | null
          referral_code: string
          referred_by: string | null
          rib: string | null
          updated_at: string
          verification_note: string | null
          verification_status: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_deposit: {
        Args: { _deposit_id: string; _note?: string }
        Returns: {
          admin_note: string | null
          amount_dzd: number
          amount_usd: number
          created_at: string
          exchange_rate: number
          id: string
          receipt_path: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_verification: {
        Args: { _note?: string; _request_id: string }
        Returns: {
          admin_note: string | null
          balance_at_request_usd: number
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "verification_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gen_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_recipient: {
        Args: { _identifier: string }
        Returns: {
          email: string
          full_name: string
          id: string
          is_admin_account: boolean
          verification_status: string
        }[]
      }
      reject_deposit: {
        Args: { _deposit_id: string; _note?: string }
        Returns: {
          admin_note: string | null
          amount_dzd: number
          amount_usd: number
          created_at: string
          exchange_rate: number
          id: string
          receipt_path: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_verification: {
        Args: { _note?: string; _request_id: string }
        Returns: {
          admin_note: string | null
          balance_at_request_usd: number
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "verification_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_verification: {
        Args: never
        Returns: {
          admin_note: string | null
          balance_at_request_usd: number
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "verification_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_transfer: {
        Args: { _amount: number; _note?: string; _recipient_identifier: string }
        Returns: {
          amount_usd: number
          created_at: string
          id: string
          note: string | null
          recipient_id: string
          sender_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      topup_card: {
        Args: { _amount: number; _card_id: string }
        Returns: {
          balance_usd: number
          card_number_last4: string
          card_number_masked: string
          cardholder_name: string
          created_at: string
          cvv_encrypted: string
          expiry_month: number
          expiry_year: number
          id: string
          status: Database["public"]["Enums"]["card_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "virtual_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
      card_status: "active" | "frozen" | "cancelled"
      deposit_status: "pending" | "approved" | "rejected"
      loan_status:
        | "pending"
        | "approved"
        | "rejected"
        | "repaying"
        | "completed"
      tx_type:
        | "deposit"
        | "loan_disbursement"
        | "loan_repayment"
        | "card_topup"
        | "card_refund"
        | "referral_bonus"
        | "adjustment"
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
      app_role: ["admin", "user"],
      card_status: ["active", "frozen", "cancelled"],
      deposit_status: ["pending", "approved", "rejected"],
      loan_status: ["pending", "approved", "rejected", "repaying", "completed"],
      tx_type: [
        "deposit",
        "loan_disbursement",
        "loan_repayment",
        "card_topup",
        "card_refund",
        "referral_bonus",
        "adjustment",
      ],
    },
  },
} as const
