// VICTORIA PROJECT — Supabase connection
// 1) Create a project at https://supabase.com
// 2) Project Settings > API 에서 URL과 anon public key를 복사해 아래에 붙여넣으세요.
// 3) supabase/schema.sql 을 SQL Editor에서 한 번 실행하세요.
// anon key는 공개되어도 되는 키입니다 (RLS 정책이 실제 접근 권한을 통제합니다).

const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
