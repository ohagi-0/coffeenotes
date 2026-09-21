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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bean_images: {
        Row: {
          bean_id: string
          created_at: string
          id: string
          side: string
          storage_path: string
          user_id: string
        }
        Insert: {
          bean_id: string
          created_at?: string
          id?: string
          side: string
          storage_path: string
          user_id: string
        }
        Update: {
          bean_id?: string
          created_at?: string
          id?: string
          side?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bean_images_bean_id_fkey"
            columns: ["bean_id"]
            isOneToOne: false
            referencedRelation: "beans"
            referencedColumns: ["id"]
          },
        ]
      }
      beans: {
        Row: {
          altitude_m: number | null
          country: string | null
          created_at: string
          description: string | null
          flavor_notes: string[]
          id: string
          name: string
          ocr_raw: Json | null
          price_grams: number | null
          price_jpy: number | null
          process: string | null
          reference_url: string | null
          region: string | null
          roast_level: string | null
          roasted_on: string | null
          roaster_id: string | null
          source: string
          taste_acidity: number | null
          taste_aftertaste: number | null
          taste_body: number | null
          taste_flavor: number | null
          taste_sweetness: number | null
          updated_at: string
          user_id: string
          variety: string | null
        }
        Insert: {
          altitude_m?: number | null
          country?: string | null
          created_at?: string
          description?: string | null
          flavor_notes?: string[]
          id?: string
          name: string
          ocr_raw?: Json | null
          price_grams?: number | null
          price_jpy?: number | null
          process?: string | null
          reference_url?: string | null
          region?: string | null
          roast_level?: string | null
          roasted_on?: string | null
          roaster_id?: string | null
          source: string
          taste_acidity?: number | null
          taste_aftertaste?: number | null
          taste_body?: number | null
          taste_flavor?: number | null
          taste_sweetness?: number | null
          updated_at?: string
          user_id: string
          variety?: string | null
        }
        Update: {
          altitude_m?: number | null
          country?: string | null
          created_at?: string
          description?: string | null
          flavor_notes?: string[]
          id?: string
          name?: string
          ocr_raw?: Json | null
          price_grams?: number | null
          price_jpy?: number | null
          process?: string | null
          reference_url?: string | null
          region?: string | null
          roast_level?: string | null
          roasted_on?: string | null
          roaster_id?: string | null
          source?: string
          taste_acidity?: number | null
          taste_aftertaste?: number | null
          taste_body?: number | null
          taste_flavor?: number | null
          taste_sweetness?: number | null
          updated_at?: string
          user_id?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beans_roaster_id_fkey"
            columns: ["roaster_id"]
            isOneToOne: false
            referencedRelation: "roasters"
            referencedColumns: ["id"]
          },
        ]
      }
      log_tags: {
        Row: {
          log_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          log_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          log_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_tags_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          bean_id: string
          brew_method: string | null
          brew_time_sec: number | null
          created_at: string
          dose_g: number | null
          grind_setting: string | null
          grinder: string | null
          id: string
          kind: string
          logged_on: string
          memo: string | null
          photo_path: string | null
          place: string
          purchased_grams: number | null
          rating: number | null
          recipe_memo: string | null
          roast_id: string | null
          shop_id: string | null
          updated_at: string
          user_id: string
          water_g: number | null
          water_temp_c: number | null
        }
        Insert: {
          bean_id: string
          brew_method?: string | null
          brew_time_sec?: number | null
          created_at?: string
          dose_g?: number | null
          grind_setting?: string | null
          grinder?: string | null
          id?: string
          kind?: string
          logged_on?: string
          memo?: string | null
          photo_path?: string | null
          place: string
          purchased_grams?: number | null
          rating?: number | null
          recipe_memo?: string | null
          roast_id?: string | null
          shop_id?: string | null
          updated_at?: string
          user_id: string
          water_g?: number | null
          water_temp_c?: number | null
        }
        Update: {
          bean_id?: string
          brew_method?: string | null
          brew_time_sec?: number | null
          created_at?: string
          dose_g?: number | null
          grind_setting?: string | null
          grinder?: string | null
          id?: string
          kind?: string
          logged_on?: string
          memo?: string | null
          photo_path?: string | null
          place?: string
          purchased_grams?: number | null
          rating?: number | null
          recipe_memo?: string | null
          roast_id?: string | null
          shop_id?: string | null
          updated_at?: string
          user_id?: string
          water_g?: number | null
          water_temp_c?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_bean_id_fkey"
            columns: ["bean_id"]
            isOneToOne: false
            referencedRelation: "beans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_roast_id_fkey"
            columns: ["roast_id"]
            isOneToOne: false
            referencedRelation: "roasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      roasters: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          name_normalized: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          name_normalized?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          name_normalized?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      roasts: {
        Row: {
          bean_id: string
          created_at: string
          duration_sec: number | null
          green_grams: number | null
          green_shop_id: string | null
          id: string
          memo: string | null
          method: string | null
          roast_level: string | null
          roasted_grams: number | null
          roasted_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bean_id: string
          created_at?: string
          duration_sec?: number | null
          green_grams?: number | null
          green_shop_id?: string | null
          id?: string
          memo?: string | null
          method?: string | null
          roast_level?: string | null
          roasted_grams?: number | null
          roasted_on: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bean_id?: string
          created_at?: string
          duration_sec?: number | null
          green_grams?: number | null
          green_shop_id?: string | null
          id?: string
          memo?: string | null
          method?: string | null
          roast_level?: string | null
          roasted_grams?: number | null
          roasted_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roasts_bean_id_fkey"
            columns: ["bean_id"]
            isOneToOne: false
            referencedRelation: "beans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roasts_green_shop_id_fkey"
            columns: ["green_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          external_place_id: string | null
          id: string
          kind: string | null
          lat: number | null
          lng: number | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          external_place_id?: string | null
          id?: string
          kind?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          external_place_id?: string | null
          id?: string
          kind?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
