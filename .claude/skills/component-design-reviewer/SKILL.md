---
name: component-design-reviewer
description: Reviews React components and provides improvement suggestions. Use when you need code review, component review, structure improvement, refactoring, or component separation.
allowed-tools: Read, Grep, Glob
---

# Component Design Reviewer

React 컴포넌트 설계 원칙에 따른 전문적인 코드 리뷰를 제공하는 Skill입니다. Claude가 직접 코드를 분석하여 5가지 핵심 원칙을 중심으로 상세한 리포트를 생성합니다.

## 검사 원칙 요약

1. **SRP** - 하나의 컴포넌트, 하나의 역할
2. **Props** - drilling 최소화, 명확한 interface
3. **Composition** - 상속보다 합성
4. **Reusability** - 공통 요소 추출
5. **Custom Hooks** - UI/비즈니스 로직 분리

## Instructions

1. Read로 대상 컴포넌트 파일 읽기
2. 5가지 원칙별로 체크리스트 기반 분석
3. Grep으로 props drilling, hooks 패턴 검색
4. 컴포넌트 분리를 제안하기 전에 아래 "분리 제안 예외 조건"으로 Props 전달 깊이를 검증
5. 컴포넌트별 리포트 생성 (Critical/Warning/Suggestion)
6. 문제마다 "문제 코드" vs "개선 코드" 예시 제공

## 분리 제안 예외 조건 (Props 전달 3단계 제한)

SRP를 기계적으로 적용해 컴포넌트를 쪼개면, 쪼갠 조각 사이에서 Props만 받아 넘기는 중간 컴포넌트가 생겨 오히려 Props Drilling이 심해진다. 분리의 목적은 이해하기 쉬운 구조인데, 전달 경로가 길어지면 그 목적을 해친다. 그래서 분리를 제안하기 전에 다음을 확인한다.

1. **분리 후 전달 깊이를 먼저 센다.** 상태나 콜백을 가진 컴포넌트(소유자)에서 그 값을 실제로 쓰는 컴포넌트(소비자)까지, Props가 지나가는 컴포넌트 경계 수를 센다. 소유자 → 소비자 직접 전달이 1단계다.
   예: `Board`가 `onEdit`을 갖고 `Board → Column → SortableCard → CardView`로 내려 `CardView`가 쓰면 3단계(Column 1, SortableCard 2, CardView 3)다. 여기서 `CardView`의 버튼을 `CardActions`로 빼면 4단계가 된다. 분리안마다 이 경로를 그려서 센다. 값이 여러 개면 가장 깊은 경로를 기준으로 한다.
2. **3단계 이하이면 분리를 그대로 제안한다.** 중간 컴포넌트가 값을 쓰지 않고 넘기기만 해도 3단계까지는 허용한다.
3. **3단계를 넘으면 그 분리안을 제안하지 않는다.** 대신 아래 대안 중 하나로 바꿔 제안하고, 리포트에 "단순 분리 시 N단계 drilling이 생겨 대안을 택했다"고 밝힌다.
   - Context 또는 Provider로 소비자가 값을 직접 읽게 한다.
   - `children`/slot(ReactNode props)으로 합성해서 중간 컴포넌트가 값을 모르게 한다.
   - 로직만 Custom Hook으로 빼고 컴포넌트는 나누지 않는다.
   - 분리하지 않고 두되, 이유를 Suggestion으로 남긴다. 파일이 150줄을 넘어도 분리 비용이 더 크면 Critical이 아니라 Suggestion이다.
4. **이미 3단계를 넘은 기존 코드는** Props 설계 위반으로 보고하고 위 대안으로 해소하는 방법을 제시한다.

"개선 코드" 예시에도 같은 기준을 적용한다. 예시 안에서 새 drilling을 만들면 안 된다.

## 리뷰 체크리스트

### 단일 책임 원칙 검사
- [ ] 컴포넌트가 하나의 역할만 수행하는가? (위반 신호: 이름에 "And" 포함)
- [ ] UI 렌더링과 비즈니스 로직이 분리되어 있는가? (위반 신호: 여러 API 호출)
- [ ] 컴포넌트 크기가 적절한가? (권장: 150줄 이하)
- [ ] 조건부 렌더링이 복잡하지 않은가? (권장: 3단계 이내)

### Props 설계 검사
- [ ] Props drilling이 3단계를 넘는가? (넘으면 위 "분리 제안 예외 조건"의 대안 적용)
- [ ] Props interface가 명확하게 정의되어 있는가?
- [ ] Default props가 적절히 활용되고 있는가?
- [ ] Props 개수가 적절한가? (권장: 7개 이하)

### 합성 패턴 검사
- [ ] 상속 대신 합성을 사용했는가?
- [ ] children props를 적절히 활용했는가?
- [ ] 컴포넌트 합성이 유연한가?
- [ ] Render props / Compound components가 필요한 상황인가?

### 재사용성 검사
- [ ] 공통 UI 요소가 추출되어 있는가?
- [ ] 범용 vs 특화 컴포넌트가 적절히 구분되어 있는가?
- [ ] 컴포넌트가 다른 곳에서 재사용 가능한가?
- [ ] 하드코딩된 값이 없는가?

### Custom Hooks 검사
- [ ] 비즈니스 로직이 custom hooks로 분리되어 있는가?
- [ ] useState/useEffect 로직이 컴포넌트 내에 과도하게 있지 않은가?
- [ ] 재사용 가능한 로직이 hooks로 추출되어 있는가?
- [ ] Hooks 명명이 use로 시작하고 명확한가?

## 출력 형식

[examples.md](examples.md)의 "리뷰 출력 형식" 섹션을 따를 것