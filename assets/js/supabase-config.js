// VICTORIA PROJECT — Supabase connection
// 1) Create a project at https://supabase.com
// 2) Project Settings > API 에서 URL과 anon public key를 복사해 아래에 붙여넣으세요.
// 3) supabase/schema.sql 을 SQL Editor에서 한 번 실행하세요.
// anon key는 공개되어도 되는 키입니다 (RLS 정책이 실제 접근 권한을 통제합니다).

const SUPABASE_URL = "https://bvmfqjovgbdcyhdyyuk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bWZxa2pvdmdiZGN5aGR5eXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNjQyNTEsImV4cCI6MjA5ODk0MDI1MX0.Ota7IM6JrViw82U_Ttn58cLUaJHeQWB8E19fcHspld4";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
