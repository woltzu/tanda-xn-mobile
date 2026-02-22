import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Supabase project credentials
const SUPABASE_URL = "https://fjqdkyjkwqeoafwvnjgv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcWRreWprd3Flb2Fmd3Zuamd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMDgzMzgsImV4cCI6MjA4MTY4NDMzOH0.baOALengNrKsBVK3B3XttQpIK4TVS3C9aBZPexNZ6nA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, auto-detect auth tokens in URL after email verification redirect
    // On native, deep links are handled manually in AuthContext
    detectSessionInUrl: Platform.OS === "web",
  },
});
