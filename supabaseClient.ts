import { createClient } from '@supabase/supabase-js';

// --- HƯỚNG DẪN QUAN TRỌNG ---
// Bạn cần thay thế 2 giá trị dưới đây bằng thông tin từ Project Supabase của bạn.
// Vào: Project Settings -> API -> Lấy URL và "anon public" Key.

const SUPABASE_URL = 'https://enwtdxsinioegcnlwhnv.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVud3RkeHNpbmlvZWdjbmx3aG52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzExMzMsImV4cCI6MjA5MjUwNzEzM30.gYayQboZbvkDi1YiXp3zdQuOAfgQR9ykhq3jlHbliOc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);