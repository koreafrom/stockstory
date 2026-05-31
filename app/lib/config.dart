// Supabase 공개 설정 (대시보드 > Project Settings > API)
// 여기 들어가는 건 anon(public) 키입니다 — 앱에 포함해도 안전합니다.
// service_role 키는 절대 앱에 넣지 마세요(서버 전용).
//
// 빌드 시 --dart-define 으로 덮어쓸 수도 있습니다.

class AppConfig {
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://YOUR-PROJECT.supabase.co',
  );

  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'YOUR_ANON_KEY',
  );
}
