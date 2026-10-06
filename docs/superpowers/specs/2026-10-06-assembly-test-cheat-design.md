# 조립 테스트 치트 버튼 설계

- 날짜: 2026-10-06
- 목적: 진행도와 상관없이 무기 조립(모듈 장착)만 바로 테스트할 수 있게, 장비와 모듈을 한 번에 채워 주는 치트 버튼을 추가한다.

## 결정 사항

- 장비 범위: 무기(권총·소총) + 방어구(고물·철 방어구)
- 지급 방식: **부족한 것만 채우기**. 같은 버튼을 여러 번 눌러도 무기는 쌓이지 않고 모듈만 다시 채워진다.
- 모듈 목표 보유량: 종류별 20개 (인벤토리 기준)

## 버튼

- 위치: 상단 치트 버튼 줄(`.top-controls`)의 `치트 - 일기 전체` 버튼 바로 뒤
- id: `cheat-assembly-test-kit`, 라벨: `치트 - 조립 테스트`, 클래스: `cheat-btn`

## 동작: `grantAssemblyTestKit(state)`

새 파일 `src/core/actions/cheatActions.ts`에 둔다. 순서:

1. `state.buildings.workbench`가 1 미만이면 1로 설치한다(비용 없음). 조립 탭 해금 조건이다.
2. 무기: `pistol`, `rifle` 가운데 `state.weapons`에 없는 타입만 1자루 생성한다. 선택된 무기가 없으면 처음 생성한 무기가 선택된다.
3. 방어구: `resources.junkArmor`, `resources.ironArmor`가 1 미만이면 1로 맞춘다.
4. 모듈: `MODULE_TYPES` 9종 각각 `state.modules[type]`이 20 미만이면 20으로 맞춘다. 장착된 모듈은 세지 않고, 이미 20 이상이면 그대로 둔다.
5. 로그: `치트: 조립 테스트 세트를 채웠다.`
6. 탐험 중(`exploration.mode === 'active'`)이 아니면 조립 탭으로 전환한다.

## 코드 연결

- `src/ui/types.ts`: `Handlers`에 `onCheatAssemblyTestKit: () => void` 추가
- `src/ui/render.ts`: 상단 치트 버튼 줄에 버튼 추가
- `src/ui/interactions/baseBinder.ts`: `#cheat-assembly-test-kit` 클릭 → `handlers.onCheatAssemblyTestKit`
- `src/main.ts`: `syncState()` → `grantAssemblyTestKit(state)` → `appMounted = false` → `redraw()` (탭·패널 구조를 즉시 다시 그림)
- 무기 생성 공용화: `src/core/tick.ts`의 비공개 `makeWeapon` 안에 있는 ID 발급·슬롯 50칸 초기화·자동 선택 로직을 `src/core/actions/equipmentActions.ts`의 `addWeapon(state, type)`으로 옮긴다. `makeWeapon`은 `addWeapon` 호출 후 기존 제작 완료 로그를 그대로 남긴다.

## 부수 효과

- 금속 프린터가 설치되면 다음 틱의 `evaluateUnlocks`가 연구실(lab) 해금 조건을 만족시켜 `데이터 단말기` 사건 팝업이 한 번 뜬다. 정상 진행과 같은 흐름이므로 막지 않는다. 탐험 중에 누르면 이 팝업이 탐험 화면 위에 뜬다.
- 분쇄기가 없는 세이브에서 쓰면 `unlocks.workbench`는 꺼진 채 금속 프린터만 설치된다. 나중에 분쇄기를 지으면 이미 설치된 금속 프린터에 대해 `정밀 부품` 사건 팝업이 뜬다(무해).
- 결과는 다른 치트와 마찬가지로 자동 저장된다. 단, 기존 세이브 로더(`normalizeState`)가 방어구 자원을 읽지 않는 버그가 있어 새로고침하면 방어구가 0으로 돌아간다. 이 버그는 별도 작업으로 다루며, 그 전까지는 치트를 다시 누르면 채워진다.

## 범위 밖

- 모듈 제작 II·III 연구 해금, 무한 모듈 모드, 단축키

## 검증

- 테스트 러너가 없으므로 `npm run build`(tsc 타입 검사 포함)와 브라우저 수동 확인으로 검증한다.
  - 새 세이브에서 버튼 클릭 → 조립 탭 이동, 권총·소총 각 1자루, 모듈 9종 각 20개, 방어구 2종 보유
  - 모듈 몇 개 장착 후 다시 클릭 → 무기 수 그대로, 인벤토리 모듈만 20개로 복구
