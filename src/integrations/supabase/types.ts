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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          id: string
          sort_order: number | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          description?: string | null
          id?: string
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          default_value: Json | null
          display: string | null
          enabled: boolean | null
          field_type: string
          id: string
          key: string
          name: string
          options: string[] | null
          required: boolean | null
          sort_order: number | null
          user_id: string
          validation: Json | null
        }
        Insert: {
          default_value?: Json | null
          display?: string | null
          enabled?: boolean | null
          field_type: string
          id?: string
          key: string
          name: string
          options?: string[] | null
          required?: boolean | null
          sort_order?: number | null
          user_id: string
          validation?: Json | null
        }
        Update: {
          default_value?: Json | null
          display?: string | null
          enabled?: boolean | null
          field_type?: string
          id?: string
          key?: string
          name?: string
          options?: string[] | null
          required?: boolean | null
          sort_order?: number | null
          user_id?: string
          validation?: Json | null
        }
        Relationships: []
      }
      note_lines: {
        Row: {
          collapsed: boolean | null
          content: string | null
          id: string
          indent: number | null
          line_type: string | null
          note_id: string
          sort_order: number | null
        }
        Insert: {
          collapsed?: boolean | null
          content?: string | null
          id?: string
          indent?: number | null
          line_type?: string | null
          note_id: string
          sort_order?: number | null
        }
        Update: {
          collapsed?: boolean | null
          content?: string | null
          id?: string
          indent?: number | null
          line_type?: string | null
          note_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "note_lines_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          date: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          security_answer_hash: string
          security_question: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id: string
          security_answer_hash: string
          security_question: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          security_answer_hash?: string
          security_question?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          activity_creation_mode: string | null
          allow_reopen_completed: boolean | null
          autosave_enabled: boolean
          color_theme: string
          default_sort: string | null
          font_family: string
          font_size: string
          id: string
            list_display: Json | null
            mobile_layout_mode: string | null
            note_line_spacing: string | null
            saved_filters: Json | null
            saved_sort: Json | null
          theme_mode: string
          user_id: string
        }
        Insert: {
          activity_creation_mode?: string | null
          allow_reopen_completed?: boolean | null
          autosave_enabled?: boolean
          color_theme?: string
          default_sort?: string | null
          font_family?: string
          font_size?: string
          id?: string
            list_display?: Json | null
            mobile_layout_mode?: string | null
            note_line_spacing?: string | null
            saved_filters?: Json | null
            saved_sort?: Json | null
          theme_mode?: string
          user_id: string
        }
        Update: {
          activity_creation_mode?: string | null
          allow_reopen_completed?: boolean | null
          autosave_enabled?: boolean
          color_theme?: string
          default_sort?: string | null
          font_family?: string
          font_size?: string
          id?: string
            list_display?: Json | null
            mobile_layout_mode?: string | null
            note_line_spacing?: string | null
            saved_filters?: Json | null
            saved_sort?: Json | null
          theme_mode?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_username_exists: { Args: { p_username: string }; Returns: boolean }
      get_security_question: { Args: { p_username: string }; Returns: string }
      get_user_id_by_username: { Args: { p_username: string }; Returns: string }
      verify_security_answer: {
        Args: { p_answer_hash: string; p_username: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
