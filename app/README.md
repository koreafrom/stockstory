# 앱 (Flutter) — 셋업 가이드

이 `lib/` 와 `pubspec.yaml` 은 Flutter 프로젝트에 얹는 코드입니다.
아래 순서대로 한 번만 설정하면 됩니다.

## 1. 프로젝트 생성 후 코드 얹기

```bash
flutter create stock_alert
cd stock_alert
# 이 폴더의 pubspec.yaml 과 lib/ 를 프로젝트로 복사(덮어쓰기)
flutter pub get
```

## 2. Firebase 연결 (FlutterFire)

```bash
dart pub global activate flutterfire_cli
flutterfire configure
```

- `lib/firebase_options.dart` 가 생성됩니다 (main.dart 가 이걸 import 함).
- Android: `android/app/google-services.json` 이 자동 배치됩니다.
- iOS 는 나중에(99달러 가입 후) 같은 명령으로 추가하면 됩니다.

## 3. Supabase 키 넣기

`lib/config.dart` 의 `supabaseUrl`, `supabaseAnonKey` 를 채우거나, 실행 시 주입:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=공개_anon_키
```

> 여기 쓰는 건 **anon(public) 키**입니다. service_role 키는 절대 앱에 넣지 마세요.

## 4. Android 최소 설정

- `android/app/build.gradle` 의 `minSdkVersion` 을 23 이상으로.
- FlutterFire 가 google-services 플러그인을 대부분 자동으로 추가합니다. 빌드 에러가 나면 FlutterFire 문서의 Android 단계만 확인하세요.

## 4-1. 간편로그인(OAuth) 설정

카카오·구글 로그인을 쓰려면 세 군데를 맞춰야 합니다.

1. 제공자 앱 등록 (무료)
   - 카카오: Kakao Developers 에서 앱 생성 → REST API 키(client_id) + Client Secret 발급 → Kakao Login 활성화, OpenID Connect 켜기, 동의항목(email, nickname) 설정.
   - 구글: Google Cloud 콘솔에서 OAuth 클라이언트 생성.
2. Supabase 대시보드 > Authentication > Providers 에서 Kakao / Google 켜고 위 키 입력.
   - 같은 화면의 Redirect URLs 에 앱 스킴 `io.supabase.stockalert://login-callback/` 추가.
3. 딥링크(앱 복귀) 설정 — 안드로이드 `AndroidManifest.xml` 의 메인 액티비티에 intent-filter 추가:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="io.supabase.stockalert" android:host="login-callback" />
</intent-filter>
```

> 네이버는 Supabase 기본 미지원(추후 커스텀), 애플은 iOS 진행 시 추가합니다.

## 5. 실행

```bash
flutter run
```

이메일/비밀번호로 가입 → 로그인되면 홈 화면이 뜨고, 알림 권한을 물은 뒤
FCM 토큰이 Supabase `devices` 테이블에 저장됩니다. 그 토큰으로 백엔드 수집기가 푸시를 보냅니다.

## 지금까지(1단계)

- 간편로그인 (카카오 / 구글, Supabase Auth OAuth)
- 기기 토큰 등록 (FCM → devices 테이블)
- 홈은 임시 화면 — 다음 단계에서 관심종목 리스트로 채움
