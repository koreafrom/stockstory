import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../main.dart';

// 간편로그인(카카오 / 구글). 네이버·애플은 추후.
// 흐름: 버튼 → 브라우저로 OAuth → 딥링크로 앱 복귀 → AuthGate 가 홈으로 전환.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _loading = false;

  // Supabase 대시보드 Redirect URLs 와 안드로이드 intent-filter 에 동일하게 등록할 스킴
  static const _redirect = 'io.supabase.stockalert://login-callback/';

  Future<void> _signIn(OAuthProvider provider) async {
    setState(() => _loading = true);
    try {
      await supabase.auth.signInWithOAuth(provider, redirectTo: _redirect);
      // 외부 브라우저로 이동. 완료 후 딥링크 복귀 시 onAuthStateChange 가 흐른다.
    } on AuthException catch (e) {
      _toast(e.message);
    } catch (e) {
      _toast('오류: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  '내 종목 한눈에',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                const Text(
                  '국내·해외 공시·공모주를 한 곳에서',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.black54),
                ),
                const SizedBox(height: 40),

                // 카카오
                _SocialButton(
                  label: '카카오로 시작하기',
                  icon: Icons.chat_bubble,
                  background: const Color(0xFFFEE500),
                  foreground: const Color(0xFF191600),
                  onPressed: _loading ? null : () => _signIn(OAuthProvider.kakao),
                ),
                const SizedBox(height: 12),

                // 구글
                _SocialButton(
                  label: '구글로 시작하기',
                  icon: Icons.g_mobiledata,
                  background: Colors.white,
                  foreground: Colors.black87,
                  border: true,
                  onPressed: _loading ? null : () => _signIn(OAuthProvider.google),
                ),

                const SizedBox(height: 24),
                if (_loading)
                  const Center(
                    child: SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.background,
    required this.foreground,
    required this.onPressed,
    this.border = false,
  });

  final String label;
  final IconData icon;
  final Color background;
  final Color foreground;
  final VoidCallback? onPressed;
  final bool border;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: background,
          foregroundColor: foreground,
          side: border ? const BorderSide(color: Colors.black12) : BorderSide.none,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        onPressed: onPressed,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
