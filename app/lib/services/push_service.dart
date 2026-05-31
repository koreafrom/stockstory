import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../main.dart';

// 로그인 후 호출: 알림 권한 → FCM 토큰 → devices 테이블에 등록
// RLS 정책상 user_id 가 본인이면 insert/update 가 허용된다.
class PushService {
  static Future<void> registerCurrentDevice() async {
    final messaging = FirebaseMessaging.instance;

    await messaging.requestPermission();

    final token = await messaging.getToken();
    final user = supabase.auth.currentUser;
    if (token == null || user == null) return;

    await _save(user.id, token);

    // 토큰이 갱신되면 다시 저장
    messaging.onTokenRefresh.listen((newToken) {
      final u = supabase.auth.currentUser;
      if (u != null) _save(u.id, newToken);
    });
  }

  static Future<void> _save(String userId, String token) async {
    try {
      await supabase.from('devices').upsert(
        {
          'user_id': userId,
          'fcm_token': token,
          'platform':
              defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
          'updated_at': DateTime.now().toIso8601String(),
        },
        onConflict: 'fcm_token',
      );
    } catch (e) {
      debugPrint('기기 토큰 저장 실패: $e');
    }
  }
}
