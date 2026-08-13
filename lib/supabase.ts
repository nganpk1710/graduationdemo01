import { createClient } from "@supabase/supabase-js";

// These are public browser credentials protected by Supabase RLS. Environment
// variables can override them for another deployment; no service-role key is
// ever exposed here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://axmmdepqmwadirbvkktc.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_a7FKgXD8u6KKE1V6Io_aGg_kLNG4UXD";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type MessageRow = {
  id: string;
  sender_name: string;
  content: string | null;
  image_path: string | null;
  card_type: "text" | "image" | "mixed";
  card_style: "blue" | "green" | "yellow" | "slate";
  canvas_x: number;
  canvas_y: number;
  rotation: number;
  moderation_status: "pending" | "approved" | "hidden";
  created_at: string;
};
