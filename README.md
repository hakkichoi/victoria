# VICTORIA PROJECT — 설정 및 배포 가이드

## 구조
```
victoria/
├── index.html          # 메인 (히어로/프로젝트/코인교환/BLC)
├── login.html          # 로그인 (이메일 + 구글)
├── signup.html         # 회원가입 (이메일 인증번호)
├── mypage.html          # 마이페이지 (회원정보/신청내역/완료내역)
├── admin.html          # 관리자 페이지
├── assets/
│   ├── css/style.css
│   ├── js/ (i18n.js, app.js, exchange.js, blc-chart.js, mypage.js, admin.js, supabase-config.js)
│   └── BLC_Whitepaper.pdf   # 직접 교체해서 넣어주세요
└── supabase/schema.sql  # DB 스키마 (최초 1회 실행)
```

## 1) Supabase 프로젝트 만들기
1. https://supabase.com 에서 새 프로젝트 생성 (무료 티어로 충분히 시작 가능)
2. **SQL Editor** 에서 `supabase/schema.sql` 내용을 전체 붙여넣고 실행 → 테이블/보안정책(RLS)/트리거 생성
3. **Project Settings → API** 에서 `Project URL` 과 `anon public` 키를 복사
4. `assets/js/supabase-config.js` 파일의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 값을 교체

## 2) 이메일 인증번호(OTP) 설정 — 중요
기본값은 Supabase가 "링크 클릭" 방식 확인 메일을 보내지만, PPT 요구사항대로 **숫자 인증번호 입력** 방식으로 바꾸려면:
1. Supabase 대시보드 → **Authentication → Email Templates → Confirm signup**
2. 템플릿 본문에 `{{ .Token }}` 변수를 포함하도록 수정 (6자리 인증번호가 이 변수로 전달됩니다)
   - 예: `인증번호: {{ .Token }}`
3. **Authentication → Providers → Email** 에서 "Confirm email" 이 켜져 있는지 확인

이렇게 하면 `signup.html`의 흐름(가입 → 메일로 6자리 코드 수신 → 코드 입력 → 인증 완료)이 그대로 동작합니다.

## 3) 구글 로그인 설정
1. Supabase 대시보드 → **Authentication → Providers → Google** 활성화
2. Google Cloud Console에서 OAuth 클라이언트 ID/Secret 발급 후 위 화면에 입력
3. **승인된 리디렉션 URI**에 Supabase가 안내하는 콜백 URL과, 실제 배포 도메인(GitHub Pages 주소)을 추가

## 4) 첫 관리자 계정 만들기
1. 사이트에서 일반 회원가입을 한 번 진행
2. Supabase SQL Editor에서 실행:
   ```sql
   update public.profiles set is_admin = true where email = '본인이메일@example.com';
   ```
3. 이후 해당 계정으로 로그인하면 상단 메뉴에 "관리자" 링크가 나타납니다.

## 5) GitHub Pages 배포
1. 새 GitHub 저장소 생성 후 이 폴더 전체를 푸시
2. 저장소 **Settings → Pages → Branch**를 `main` (또는 `master`) / `root`로 설정
3. 발급된 `https://<계정>.github.io/<repo>/` 주소가 사이트 URL
4. 구글 로그인 리디렉션 URI에 이 주소를 추가하는 것 잊지 마세요 (4단계 참고)

## 데이터 흐름 요약
- **회원 인증/비밀번호**: Supabase Auth (비밀번호는 Supabase가 안전하게 해싱하여 저장 — 이 프로젝트 코드는 비밀번호를 직접 다루지 않습니다)
- **회원 정보/코인교환 신청/완료내역**: Supabase Postgres 테이블 (`profiles`, `exchange_requests`)
- **BLC 가격/환율**: 관리자만 쓸 수 있고 누구나 읽을 수 있는 테이블 (`blc_price_history`, `exchange_rates`)
- **완료 처리 잠금**: DB 정책(RLS) 레벨에서 `status = 'completed'`가 되면 일반 사용자는 더 이상 수정 불가하도록 강제되어 있어, 프론트엔드 코드를 우회해도 안전합니다.
- **정적 파일(HTML/CSS/JS)**: GitHub Pages에서 그대로 호스팅

## 남은 할 일 (제가 만들지 않은 부분)
- `assets/BLC_Whitepaper.pdf` 실제 백서 파일로 교체
- 5개 언어 문구 중 실제 법인/약관 정보가 필요한 부분(회사소개 등) 채워넣기
- 도메인 연결 시 Google OAuth 리디렉션 URI 갱신
- **협력 은행 로고 영역**: 지금은 실제 로고 이미지가 아니라 은행명을 텍스트 카드로 표시해두었습니다 (`assets/js/app.js`의 `PARTNER_BANKS` 배열). 실제 은행 로고(HSBC, Barclays 등)는 상표권이 있는 자산이라 임의로 이미지화하지 않았습니다. 실제 파트너십 계약이 체결된 은행만 표시하시고, 로고 이미지를 쓰실 경우 각 은행의 브랜드 가이드라인/사용 승인 절차를 먼저 확인해주세요.
