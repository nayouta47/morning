# 조립 테스트 치트 버튼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상단 치트 버튼 줄에 `치트 - 조립 테스트` 버튼을 추가해, 누르면 금속 프린터 설치·무기·방어구·모듈을 부족한 만큼 채우고 조립 탭으로 이동하게 한다.

**Architecture:** 게임 상태 변경은 `src/core/actions/cheatActions.ts`의 순수 함수 `grantAssemblyTestKit(state)` 하나에 모은다. 무기 생성 로직은 `tick.ts`의 비공개 함수에서 `equipmentActions.ts`의 `addWeapon`으로 옮겨 제작 완료 처리와 치트가 같이 쓴다. UI는 기존 치트 버튼과 같은 경로(render → baseBinder → Handlers → main.ts)로 연결한다.

**Tech Stack:** TypeScript 5.9, Vite 7.3 (vanilla DOM, 프레임워크 없음). 테스트 러너가 없으므로 검증은 세션 스크래치패드의 `node:test` 스크립트(Vite `ssrLoadModule`로 TS 모듈 로드)와 `npm run build`(tsc 포함), 브라우저 확인으로 한다.

## Global Constraints

- 새 npm 의존성을 추가하지 않는다. 검증 스크립트는 저장소에 커밋하지 않는다.
- 버튼 라벨은 정확히 `치트 - 조립 테스트`, id는 `cheat-assembly-test-kit`, 클래스는 `cheat-btn`
- 로그 문구는 정확히 `치트: 조립 테스트 세트를 채웠다.`
- 모듈 목표 보유량: 종류별 20개 (인벤토리 기준, 이미 20 이상이면 유지)
- 장비 범위: 권총·소총 각 1자루, 고물·철 방어구 각 1개 (없을 때만)
- 코드 스타일: 2칸 들여쓰기, 세미콜론 없음, 작은따옴표, import 경로에 `.ts` 확장자
- 커밋 메시지: `feat:`/`refactor:` 등 접두어 + 한국어 요약, 마지막 줄에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `src/core/actions/equipmentActions.ts` | 수정 | `addWeapon(state, type)` 추가 — 무기 ID 발급, 빈 슬롯 50칸, 첫 무기 자동 선택 |
| `src/core/tick.ts` | 수정 | `makeWeapon`이 `addWeapon`을 호출하고 제작 완료 로그만 남김 |
| `src/core/actions/cheatActions.ts` | 생성 | `grantAssemblyTestKit(state)` — 조립 테스트 세트 채우기 |
| `src/core/actions/index.ts` | 수정 | `cheatActions.ts` re-export |
| `src/ui/types.ts` | 수정 | `Handlers.onCheatAssemblyTestKit` 타입 |
| `src/ui/render.ts` | 수정 | 상단 치트 버튼 줄에 버튼 마크업 |
| `src/ui/interactions/baseBinder.ts` | 수정 | 버튼 클릭 → 핸들러 |
| `src/main.ts` | 수정 | 핸들러 구현: `syncState` → `grantAssemblyTestKit` → 전체 다시 그리기 |

검증 스크립트(커밋 안 함) 위치: `SCRATCH = C:/Users/cremini/AppData/Local/Temp/claude/E--001-ProjectArchieve-morning--claude-worktrees-module-assembly-cheat-button-52fb0d/ab637f67-f33a-4a30-93ef-77935a6164cf/scratchpad`

모든 명령은 워크트리 루트 `E:/001.ProjectArchieve/morning/.claude/worktrees/module-assembly-cheat-button-52fb0d`에서 실행한다. 워크트리에는 `node_modules`가 없지만 상위의 `E:/001.ProjectArchieve/morning/node_modules`가 Node 모듈 탐색과 `npm run`의 PATH로 잡힌다.

---

### Task 1: 무기 생성 로직을 `addWeapon`으로 분리

**Files:**
- Create (검증용, 커밋 안 함): `$SCRATCH/verify/load.mjs`, `$SCRATCH/verify/add-weapon.test.mjs`
- Modify: `src/core/actions/equipmentActions.ts:1-2` (import), 파일 내 `reorderWeapons` 바로 위에 함수 추가
- Modify: `src/core/tick.ts:3` (import), `src/core/tick.ts:185-192` (`makeWeapon`)

**Interfaces:**
- Consumes: 없음
- Produces: `addWeapon(state: GameState, type: WeaponType): WeaponInstance` — `src/core/actions/equipmentActions.ts`에서 export, `src/core/actions.ts`를 통해서도 접근 가능. 로그를 남기지 않는다.

- [ ] **Step 1: 검증 스크립트용 Vite 로더 작성**

`$SCRATCH/verify/load.mjs`:

```js
import { pathToFileURL } from 'node:url'

export const ROOT = 'E:/001.ProjectArchieve/morning/.claude/worktrees/module-assembly-cheat-button-52fb0d'
const VITE_ENTRY = 'E:/001.ProjectArchieve/morning/node_modules/vite/dist/node/index.js'

export async function startGameModuleServer() {
  const { createServer } = await import(pathToFileURL(VITE_ENTRY).href)
  return createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`$SCRATCH/verify/add-weapon.test.mjs`:

```js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startGameModuleServer } from './load.mjs'

let server
let initialState
let actions
let tick

before(async () => {
  server = await startGameModuleServer()
  ;({ initialState } = await server.ssrLoadModule('/src/core/state.ts'))
  actions = await server.ssrLoadModule('/src/core/actions.ts')
  tick = await server.ssrLoadModule('/src/core/tick.ts')
})

after(async () => {
  await server?.close()
})

const freshState = () => structuredClone(initialState)

test('addWeapon: ID 발급, 빈 슬롯 50칸, 첫 무기 자동 선택', () => {
  const state = freshState()
  const pistol = actions.addWeapon(state, 'pistol')
  assert.equal(pistol.id, 'PST-0001')
  assert.equal(pistol.type, 'pistol')
  assert.equal(pistol.slots.length, 50)
  assert.ok(pistol.slots.every((slot) => slot === null))
  assert.equal(state.nextWeaponId, 2)
  assert.equal(state.weapons.length, 1)
  assert.equal(state.selectedWeaponId, 'PST-0001')
})

test('addWeapon: 이미 선택된 무기가 있으면 선택을 바꾸지 않음', () => {
  const state = freshState()
  actions.addWeapon(state, 'pistol')
  const rifle = actions.addWeapon(state, 'rifle')
  assert.equal(rifle.id, 'RFL-0002')
  assert.equal(state.selectedWeaponId, 'PST-0001')
})

test('제작 완료: 권총이 생기고 완성 로그가 남음 (회귀)', () => {
  const state = freshState()
  state.craftProgress.pistol = 1
  tick.advanceBaseOnlyStateByElapsed(state, 1000)
  assert.equal(state.weapons.length, 1)
  assert.equal(state.weapons[0].id, 'PST-0001')
  assert.equal(state.selectedWeaponId, 'PST-0001')
  assert.ok(state.messages.includes('권총이 완성됐다. PST-0001.'))
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `node --test "C:/Users/cremini/AppData/Local/Temp/claude/E--001-ProjectArchieve-morning--claude-worktrees-module-assembly-cheat-button-52fb0d/ab637f67-f33a-4a30-93ef-77935a6164cf/scratchpad/verify/add-weapon.test.mjs"`
Expected: `# pass 1`, `# fail 2` — addWeapon 테스트 2개가 `TypeError: actions.addWeapon is not a function`으로 실패, 제작 완료 회귀 테스트는 통과

- [ ] **Step 4: `addWeapon` 구현**

`src/core/actions/equipmentActions.ts` 2번째 줄 import를 바꾼다:

```ts
import type { GameState, ModuleType, WeaponInstance, WeaponType } from '../state.ts'
```

같은 파일의 `export function reorderWeapons(` 바로 위에 추가한다:

```ts
export function addWeapon(state: GameState, type: WeaponType): WeaponInstance {
  const prefix = type === 'pistol' ? 'PST' : 'RFL'
  const weapon: WeaponInstance = {
    id: `${prefix}-${String(state.nextWeaponId).padStart(4, '0')}`,
    type,
    slots: Array.from({ length: 50 }, () => null),
  }
  state.nextWeaponId += 1
  state.weapons.push(weapon)
  if (!state.selectedWeaponId) state.selectedWeaponId = weapon.id
  return weapon
}

```

`src/core/tick.ts` 3번째 줄 import를 바꾼다:

```ts
import { addWeapon, narrate, handleExplorationDeath } from './actions.ts'
```

`src/core/tick.ts`의 `makeWeapon` 전체를 바꾼다:

```ts
function makeWeapon(state: GameState, type: WeaponType): void {
  const { id } = addWeapon(state, type)
  narrate(state, `${type === 'pistol' ? '권총' : '소총'}이 완성됐다. ${id}.`)
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test "C:/Users/cremini/AppData/Local/Temp/claude/E--001-ProjectArchieve-morning--claude-worktrees-module-assembly-cheat-button-52fb0d/ab637f67-f33a-4a30-93ef-77935a6164cf/scratchpad/verify/add-weapon.test.mjs"`
Expected: `# pass 3`, `# fail 0`

Run: `node E:/001.ProjectArchieve/morning/node_modules/typescript/bin/tsc --noEmit -p .`
Expected: 출력 없음, exit 0

- [ ] **Step 6: 커밋**

```bash
git add src/core/actions/equipmentActions.ts src/core/tick.ts
git commit -F - <<'EOF'
refactor: 무기 생성 로직을 addWeapon으로 분리

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: `grantAssemblyTestKit` 구현

**Files:**
- Create (검증용, 커밋 안 함): `$SCRATCH/verify/assembly-kit.test.mjs`
- Create: `src/core/actions/cheatActions.ts`
- Modify: `src/core/actions/index.ts:1` 다음 줄에 export 추가

**Interfaces:**
- Consumes: `addWeapon(state, type): WeaponInstance` (Task 1), 기존 `setActiveTab(state, tab)` (`baseActions.ts`), `narrate(state, text)` (`logging.ts`), `MODULE_TYPES` (`src/data/modules.ts`)
- Produces: `grantAssemblyTestKit(state: GameState): void` — `src/core/actions.ts`를 통해 export

- [ ] **Step 1: 실패하는 테스트 작성**

`$SCRATCH/verify/assembly-kit.test.mjs`:

```js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startGameModuleServer } from './load.mjs'

let server
let initialState
let MODULE_TYPES
let actions
let tick

before(async () => {
  server = await startGameModuleServer()
  ;({ initialState } = await server.ssrLoadModule('/src/core/state.ts'))
  ;({ MODULE_TYPES } = await server.ssrLoadModule('/src/data/modules.ts'))
  actions = await server.ssrLoadModule('/src/core/actions.ts')
  tick = await server.ssrLoadModule('/src/core/tick.ts')
})

after(async () => {
  await server?.close()
})

const freshState = () => structuredClone(initialState)

test('새 세이브: 금속 프린터 설치, 무기 2종, 방어구 2종, 모듈 9종 x20, 조립 탭 이동', () => {
  const state = freshState()
  actions.grantAssemblyTestKit(state)

  assert.equal(state.buildings.workbench, 1)
  assert.deepEqual(state.weapons.map((weapon) => weapon.type), ['pistol', 'rifle'])
  assert.equal(state.selectedWeaponId, state.weapons[0].id)
  assert.equal(state.resources.junkArmor, 1)
  assert.equal(state.resources.ironArmor, 1)
  assert.equal(MODULE_TYPES.length, 9)
  MODULE_TYPES.forEach((type) => assert.equal(state.modules[type], 20, type))
  assert.equal(state.activeTab, 'assembly')
  assert.equal(state.messages.at(-1), '치트: 조립 테스트 세트를 채웠다.')
})

test('다시 누르기: 무기는 늘지 않고, 인벤토리만 20으로 복구, 20 초과는 유지', () => {
  const state = freshState()
  actions.grantAssemblyTestKit(state)
  const pistol = state.weapons.find((weapon) => weapon.type === 'pistol')
  assert.ok(actions.equipModuleToSlot(state, pistol.id, 'damage', 23))
  assert.equal(state.modules.damage, 19)
  state.modules.cooldown = 35

  actions.grantAssemblyTestKit(state)

  assert.equal(state.weapons.length, 2)
  assert.equal(pistol.slots[23], 'damage')
  assert.equal(state.modules.damage, 20)
  assert.equal(state.modules.cooldown, 35)
})

test('이미 있는 장비는 건드리지 않고 없는 것만 채움', () => {
  const state = freshState()
  state.buildings.workbench = 1
  actions.addWeapon(state, 'rifle')
  state.resources.ironArmor = 3

  actions.grantAssemblyTestKit(state)

  assert.deepEqual(state.weapons.map((weapon) => weapon.type), ['rifle', 'pistol'])
  assert.equal(state.selectedWeaponId, state.weapons[0].id)
  assert.equal(state.resources.ironArmor, 3)
  assert.equal(state.resources.junkArmor, 1)
})

test('탐험 중: 지급은 하되 탭은 그대로', () => {
  const state = freshState()
  state.exploration.mode = 'active'
  state.activeTab = 'exploration'

  actions.grantAssemblyTestKit(state)

  assert.equal(state.activeTab, 'exploration')
  assert.equal(state.weapons.length, 2)
  assert.equal(state.modules.damage, 20)
})

test('부수 효과: 다음 틱에 연구실 해금 조건 충족 (데이터 단말기 사건)', () => {
  const state = freshState()
  actions.grantAssemblyTestKit(state)
  assert.equal(state.unlocks.lab, false)
  tick.advanceBaseOnlyStateByElapsed(state, 1)
  assert.equal(state.unlocks.lab, true)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test "C:/Users/cremini/AppData/Local/Temp/claude/E--001-ProjectArchieve-morning--claude-worktrees-module-assembly-cheat-button-52fb0d/ab637f67-f33a-4a30-93ef-77935a6164cf/scratchpad/verify/assembly-kit.test.mjs"`
Expected: `# pass 0`, `# fail 5` — 모두 `TypeError: actions.grantAssemblyTestKit is not a function`

- [ ] **Step 3: `grantAssemblyTestKit` 구현**

`src/core/actions/cheatActions.ts` 생성:

```ts
import { MODULE_TYPES } from '../../data/modules.ts'
import type { ArmorType, GameState, WeaponType } from '../state.ts'
import { setActiveTab } from './baseActions.ts'
import { addWeapon } from './equipmentActions.ts'
import { narrate } from './logging.ts'

const ASSEMBLY_TEST_WEAPON_TYPES: WeaponType[] = ['pistol', 'rifle']
const ASSEMBLY_TEST_ARMOR_TYPES: ArmorType[] = ['junkArmor', 'ironArmor']
const ASSEMBLY_TEST_MODULE_STOCK = 20

export function grantAssemblyTestKit(state: GameState): void {
  if (state.buildings.workbench < 1) state.buildings.workbench = 1

  ASSEMBLY_TEST_WEAPON_TYPES.forEach((type) => {
    if (!state.weapons.some((weapon) => weapon.type === type)) addWeapon(state, type)
  })

  ASSEMBLY_TEST_ARMOR_TYPES.forEach((type) => {
    if (state.resources[type] < 1) state.resources[type] = 1
  })

  MODULE_TYPES.forEach((type) => {
    if (state.modules[type] < ASSEMBLY_TEST_MODULE_STOCK) state.modules[type] = ASSEMBLY_TEST_MODULE_STOCK
  })

  narrate(state, '치트: 조립 테스트 세트를 채웠다.')
  if (state.exploration.mode !== 'active') setActiveTab(state, 'assembly')
}
```

`src/core/actions/index.ts`의 `export * from './baseActions.ts'` 다음 줄에 추가:

```ts
export * from './cheatActions.ts'
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test "C:/Users/cremini/AppData/Local/Temp/claude/E--001-ProjectArchieve-morning--claude-worktrees-module-assembly-cheat-button-52fb0d/ab637f67-f33a-4a30-93ef-77935a6164cf/scratchpad/verify/assembly-kit.test.mjs"`
Expected: `# pass 5`, `# fail 0`

Run: `node --test "C:/Users/cremini/AppData/Local/Temp/claude/E--001-ProjectArchieve-morning--claude-worktrees-module-assembly-cheat-button-52fb0d/ab637f67-f33a-4a30-93ef-77935a6164cf/scratchpad/verify/add-weapon.test.mjs"`
Expected: `# pass 3`, `# fail 0`

Run: `node E:/001.ProjectArchieve/morning/node_modules/typescript/bin/tsc --noEmit -p .`
Expected: 출력 없음, exit 0

- [ ] **Step 5: 커밋**

```bash
git add src/core/actions/cheatActions.ts src/core/actions/index.ts
git commit -F - <<'EOF'
feat: 조립 테스트 세트 지급 치트 액션 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: 치트 버튼 UI 연결

**Files:**
- Modify: `src/ui/types.ts:75` 다음 줄
- Modify: `src/ui/render.ts:350` (상단 치트 버튼 마크업)
- Modify: `src/ui/interactions/baseBinder.ts:41` 다음 줄
- Modify: `src/main.ts:48` 근처 import 목록, `src/main.ts:298-304` 다음에 핸들러 추가
- Create (검증용, 커밋 안 함): `.claude/launch.json`

**Interfaces:**
- Consumes: `grantAssemblyTestKit(state: GameState): void` (Task 2)
- Produces: `Handlers.onCheatAssemblyTestKit: () => void`, DOM `#cheat-assembly-test-kit`

- [ ] **Step 1: 핸들러 타입을 먼저 추가 (컴파일 실패 유도)**

`src/ui/types.ts`의 `onCheatToggleCodexReveal: () => void` 다음 줄에 추가:

```ts
  onCheatAssemblyTestKit: () => void
```

- [ ] **Step 2: 컴파일이 실패하는지 확인**

Run: `node E:/001.ProjectArchieve/morning/node_modules/typescript/bin/tsc --noEmit -p .`
Expected: `src/main.ts`에서 `Property 'onCheatAssemblyTestKit' is missing in type ...` 오류 (TS2345 또는 TS2741), exit 1

- [ ] **Step 3: 버튼·바인딩·핸들러 구현**

`src/ui/render.ts` 350번째 줄의 상단 치트 버튼 마크업에서 아래 부분을

```
${state.codexRevealAll ? ' ON' : ' OFF'}</button><button id="delete-data"
```

다음으로 바꾼다:

```
${state.codexRevealAll ? ' ON' : ' OFF'}</button><button id="cheat-assembly-test-kit" class="cheat-btn" type="button">치트 - 조립 테스트</button><button id="delete-data"
```

`src/ui/interactions/baseBinder.ts`의 `#cheat-codex-reveal` 바인딩 다음 줄에 추가:

```ts
  app.querySelector<HTMLButtonElement>('#cheat-assembly-test-kit')?.addEventListener('click', handlers.onCheatAssemblyTestKit)
```

`src/main.ts` import 목록의 `toggleCodexRevealAll,` 다음 줄에 추가:

```ts
  grantAssemblyTestKit,
```

`src/main.ts`의 `onCheatAccelerateBaseTime` 핸들러 블록 바로 다음에 추가:

```ts
        onCheatAssemblyTestKit: () => {
          syncState()
          grantAssemblyTestKit(state)
          appMounted = false
          redraw()
        },
```

- [ ] **Step 4: 빌드 통과 확인**

Run: `npm run build`
Expected: tsc 오류 없음, `✓ built in ...` 출력, exit 0. 빌드가 `public/tools/game-data.json`을 다시 쓰므로 `git status --short`로 확인하고, 내용 변화가 없으면(줄바꿈 차이만) 커밋에 넣지 않는다.

- [ ] **Step 5: 브라우저에서 확인**

`.claude/launch.json` 생성 (커밋 안 함, 사용자의 기존 dev 서버와 겹치지 않게 5179 포트):

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "morning-dev-5179",
      "runtimeExecutable": "node",
      "runtimeArgs": ["E:/001.ProjectArchieve/morning/node_modules/vite/bin/vite.js", "--port", "5179", "--strictPort"],
      "port": 5179
    }
  ]
}
```

`preview_start`로 `morning-dev-5179`를 띄우고 `http://localhost:5179/morning/`로 이동한 뒤 확인:
1. 상단에 `치트 - 조립 테스트` 버튼이 있고 `무기 조립(잠김)` 탭이 비활성
2. 버튼 클릭 → `#tab-assembly`가 활성, 무기 인벤토리에 권총·소총 2개, 보유 모듈 9종 모두 `x20`
3. 잠시 뒤 `데이터 단말기` 사건 팝업이 뜨고 `확인`으로 닫힘
4. 모바일 폭(375px)에서 상단 치트 버튼 줄이 제목과 겹치지 않는지 확인
5. 확인이 끝나면 `preview_stop`으로 서버를 끄고 `.claude/launch.json`을 삭제

- [ ] **Step 6: 커밋**

```bash
git add src/ui/types.ts src/ui/render.ts src/ui/interactions/baseBinder.ts src/main.ts
git commit -F - <<'EOF'
feat: 조립 테스트 치트 버튼 추가 — 장비·모듈 일괄 지급

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
