import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase public configuration is missing.");
}

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
