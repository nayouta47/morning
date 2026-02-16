# morning

Vite + TypeScript 기반 웹 프로젝트입니다. GitHub Actions를 통해 **GitHub Pages**로 자동 배포됩니다.

## 배포 자동화

워크플로우 파일: `.github/workflows/deploy-pages.yml`

트리거:
- `main` 브랜치에 push 시 자동 실행
- GitHub Actions의 **Run workflow** 버튼으로 수동 실행 (`workflow_dispatch`)

배포 단계:
1. `npm ci`
2. `npm run build`
3. `dist/` 아티팩트 업로드
4. GitHub Pages 배포

## GitHub Secrets 설정

GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**

- `DISCORD_WEBHOOK_URL`

> `DISCORD_WEBHOOK_URL`이 없으면 Discord 알림만 스킵됩니다.

## GitHub Pages 설정(필수)

GitHub 저장소 → **Settings → Pages** 에서:
- **Build and deployment: Source = GitHub Actions**

## Discord 알림

배포 성공/실패 시 Discord 웹훅으로 아래를 전송합니다.
- Repository / Branch / Actor
- Build / Deploy 결과
- GitHub Actions Run 링크

## 수동 배포 실행 방법

1. GitHub 저장소의 **Actions** 탭 이동
2. **Deploy to GitHub Pages** 워크플로우 선택
3. **Run workflow** 클릭 후 `main` 브랜치로 실행

## 로컬 실행

```bash
npm ci
npm run dev
```

## 로컬 빌드 확인

```bash
npm run build
```
