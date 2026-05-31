import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../main.dart';
import '../home/main_shell.dart';
import 'login_screen.dart';

// 로그인 상태에 따라 화면을 가른다.
// 로그인/로그아웃 시 onAuthStateChange 가 흘러 자동으로 다시 그려진다.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: supabase.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final session = supabase.auth.currentSession;
        if (session != null) {
          return const MainShell();
        }
        return const LoginScreen();
      },
    );
  }
}
