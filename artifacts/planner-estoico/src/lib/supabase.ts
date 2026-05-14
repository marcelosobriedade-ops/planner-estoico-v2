import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fyqlvbmpiacwcqdjaebw.supabase.co";
const supabaseKey = "sb_publishable_UC0XqHTQuSP7cD96yUcEQg_sRGT-Cw2";

export const supabase = createClient(supabaseUrl, supabaseKey);
