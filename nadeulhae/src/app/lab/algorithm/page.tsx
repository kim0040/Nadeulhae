"use client"

/**
 * Algorithm Study Lab — a personal learning path based on the supplied
 * Python data-structures and algorithms concept book. Progress is deliberately
 * kept in browser storage: this is a self-study aid, not a shared course record.
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  BookMarked,
  BrainCircuit,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FlaskConical,
  GraduationCap,
  ListChecks,
  RotateCcw,
  Route,
  Sparkles,
  Target,
  X,
} from "lucide-react"

import { BorderBeam } from "@/components/magicui/border-beam"
import { MagicCard } from "@/components/magicui/magic-card"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { SectionCard, StatusMetric } from "@/components/dashboard/ui"
import { useAuth } from "@/context/AuthContext"
import { saveLabAiChatStudyDraft } from "@/lib/lab-ai-chat/study-draft"
import { cn } from "@/lib/utils"

type PhaseId = "foundation" | "structure" | "algorithm" | "practice"
type PracticeStepId = "read" | "trace" | "recall" | "implement"
type StudyActivityKind = "practice" | "quiz" | "complete"

type StudyModule = {
  id: string
  phase: PhaseId
  chapter: string
  title: string
  englishTitle: string
  minutes: number
  summary: string
  focus: string
  checkpoint: string
  terms: string[]
}

type Quiz = {
  question: string
  options: string[]
  answer: number
  explanation: string
  chapter: string
}

type StudyCoachAction = {
  title: string
  description: string
  request: string
}

type ExamTrack = {
  title: string
  subtitle: string
  description: string
  phase?: PhaseId
  request?: string
}

type StudyActivity = Record<StudyActivityKind, number>

type SavedProgress = {
  completedIds: string[]
  lastStudiedId: string | null
  quizCorrectCount: number
  quizAttemptCount: number
  practiceStepsByModule: Record<string, PracticeStepId[]>
  activityByDate: Record<string, StudyActivity>
}

const PRACTICE_STEPS: Array<{
  id: PracticeStepId
  label: string
  duration: string
  description: string
}> = [
  { id: "read", label: "핵심 읽기", duration: "8분", description: "왜 필요한지와 핵심 연산을 먼저 읽어요." },
  { id: "trace", label: "손으로 추적", duration: "8분", description: "작은 입력으로 상태 변수의 변화를 적어요." },
  { id: "recall", label: "회상 점검", duration: "4분", description: "화면을 덮고 규칙과 한계를 말해 봐요." },
  { id: "implement", label: "빈 화면 구현", duration: "12분", description: "힌트 없이 구조를 다시 만들어 봐요." },
]

const STUDY_COACH_ACTIONS: StudyCoachAction[] = [
  {
    title: "개념을 다시 연결하기",
    description: "왜 필요한지부터 예시까지 차근차근 설명받기",
    request: "이 단원이 어떤 문제를 해결하려고 등장했는지, 핵심 연산·불변식·복잡도·한계를 하나의 작은 예시로 연결해서 설명해줘.",
  },
  {
    title: "코드를 손으로 추적하기",
    description: "짧은 Python 예제로 상태 변화 확인하기",
    request: "이 단원을 보여 주는 짧은 Python 예제를 만들고, 작은 입력으로 한 줄씩 상태가 어떻게 바뀌는지 표로 추적해줘. 정답 코드는 마지막에 보여줘.",
  },
  {
    title: "나에게 문제 내기",
    description: "현재 단원 난이도의 미니 문제 풀기",
    request: "이 단원에 맞는 짧은 연습 문제를 하나 내줘. 먼저 힌트만 주고, 내가 풀이를 답할 때까지 전체 해답은 말하지 마.",
  },
  {
    title: "헷갈리는 지점 점검",
    description: "오답·조건·반례를 함께 확인하기",
    request: "이 단원에서 자주 헷갈리는 조건과 대표 반례를 3개 이내로 알려줘. 내가 스스로 답할 수 있게 질문부터 해줘.",
  },
]

const EXAM_TRACKS: ExamTrack[] = [
  {
    title: "소프트웨어 설계",
    subtitle: "요구사항 · UML · 객체지향",
    description: "시험 키워드를 설계 원리와 작은 사례로 연결해 복습합니다.",
    request: "정보처리기사 필기 소프트웨어 설계 영역에서 자주 나오는 요구사항 분석, UML, 객체지향 설계 개념으로 5문제 미니 퀴즈를 만들어줘. 한 문제씩 출제하고 내 답을 기다려줘.",
  },
  {
    title: "자료구조와 알고리즘",
    subtitle: "탐색 · 정렬 · 그래프 · 복잡도",
    description: "현재 진도부터 문제 풀이 감각까지 이어지는 핵심 경로입니다.",
    phase: "algorithm",
  },
  {
    title: "데이터베이스와 SQL",
    subtitle: "정규화 · 트랜잭션 · 질의",
    description: "관계형 데이터의 규칙과 SQL 선택지를 함께 점검합니다.",
    request: "정보처리기사 필기 데이터베이스 영역에서 정규화, 트랜잭션, SQL을 섞은 객관식 연습 문제를 한 문제씩 내줘. 내가 답한 뒤에만 해설과 다음 문제를 보여줘.",
  },
  {
    title: "운영체제와 네트워크",
    subtitle: "프로세스 · 동기화 · TCP/IP",
    description: "암기형 용어를 동작 흐름과 비교해 정리합니다.",
    request: "정보처리기사 필기 운영체제·네트워크 영역을 대비할 수 있게 프로세스, 동기화, TCP/IP 중심의 상황형 문제를 한 문제씩 내줘. 정답은 내가 답한 뒤에 설명해줘.",
  },
  {
    title: "실기 코드 독해",
    subtitle: "Python · 디버깅 · 로직 추적",
    description: "짧은 코드의 출력과 오류 원인을 손으로 추적하는 연습입니다.",
    phase: "practice",
  },
  {
    title: "모의 점검 만들기",
    subtitle: "오답 기반 · 난이도 조절",
    description: "현재 단원과 최근 점검 결과를 반영해 AI에게 문제를 요청합니다.",
    request: "현재 학습 맥락을 바탕으로 정보처리기사 수준의 짧은 모의 점검 5문항을 만들어줘. 한 문항씩 내고, 내 답을 기다린 뒤 채점과 오답 노트를 제공해줘. 문제를 모두 한 번에 출력하지 마.",
  },
]

const PHASES: Array<{
  id: PhaseId
  order: string
  title: string
  subtitle: string
  description: string
  tone: string
}> = [
  {
    id: "foundation",
    order: "01",
    title: "코드가 움직이는 방식",
    subtitle: "§0–§4 · 읽는 법, 파이썬, 복잡도",
    description: "이름 암기보다 상태 변화와 불변식을 먼저 보는 기초 체력을 만듭니다.",
    tone: "border-sky-blue/30 bg-sky-blue/8 text-sky-blue",
  },
  {
    id: "structure",
    order: "02",
    title: "핵심 자료구조",
    subtitle: "§5–§14 · 저장 방식과 연산",
    description: "문제에서 필요한 연산을 보고 자료구조를 고르는 감각을 잡습니다.",
    tone: "border-active-blue/25 bg-active-blue/8 text-active-blue",
  },
  {
    id: "algorithm",
    order: "03",
    title: "핵심 알고리즘",
    subtitle: "§15–§26 · 탐색, 최적화, 그래프",
    description: "문제 조건을 알고리즘 선택과 복잡도로 연결하는 단계입니다.",
    tone: "border-nature-green/30 bg-nature-green/8 text-nature-green",
  },
  {
    id: "practice",
    order: "04",
    title: "코드 독해와 기사 연결",
    subtitle: "§27–§35 · 추적, 실수, 학습 루틴",
    description: "코드를 손으로 읽고, 설명하고, 시험 맥락까지 연결합니다.",
    tone: "border-warning/30 bg-warning/10 text-warning",
  },
]

const STUDY_MODULES: StudyModule[] = [
  {
    id: "learning-map",
    phase: "foundation",
    chapter: "§0–§2",
    title: "문제에서 코드까지 연결하기",
    englishTitle: "Learning map · terms · invariants",
    minutes: 18,
    summary: "문제 상황 → 필요한 연산 → 자료구조 → 규칙 → 알고리즘 → 복잡도라는 연결을 만듭니다.",
    focus: "자료구조·ADT·구현을 구분하고, 불변식이 무엇인지 한 문장으로 말해 보세요.",
    checkpoint: "BFS의 불변식을 ‘거리 d가 d+1보다 먼저 처리된다’로 설명할 수 있다.",
    terms: ["ADT", "operation", "invariant", "traversal"],
  },
  {
    id: "python-model",
    phase: "foundation",
    chapter: "§3",
    title: "파이썬 실행 모델과 컨테이너",
    englishTitle: "Objects · references · containers",
    minutes: 24,
    summary: "변수는 상자가 아니라 이름표에 가깝고, 변경 가능 객체는 참조를 통해 함께 바뀔 수 있습니다.",
    focus: "중첩 리스트 별칭, slicing 비용, list와 deque의 차이를 코드로 확인합니다.",
    checkpoint: "[[0] * 3] * 3이 왜 세 행을 함께 바꾸는지 설명할 수 있다.",
    terms: ["mutable", "immutable", "reference", "deque"],
  },
  {
    id: "complexity",
    phase: "foundation",
    chapter: "§4",
    title: "복잡도로 코드 읽기",
    englishTitle: "Time · space · Big-O",
    minutes: 22,
    summary: "반복문의 모양을 보고 시간·공간 복잡도를 말하는 기준을 세웁니다.",
    focus: "연속과 중첩, log 증가, 상각 분석을 각각 작은 코드에 적용합니다.",
    checkpoint: "list.append가 가끔 O(n)이어도 상각 O(1)인 이유를 말할 수 있다.",
    terms: ["Big-O", "Big-Theta", "amortized", "space complexity"],
  },
  {
    id: "array",
    phase: "structure",
    chapter: "§5",
    title: "배열과 파이썬 리스트",
    englishTitle: "Array · dynamic array · list",
    minutes: 20,
    summary: "인덱스 접근이 빠른 대신 중간 삽입·삭제가 왜 비싼지 이해합니다.",
    focus: "최댓값을 직접 찾으며 상태 변수와 반복 불변식을 표시합니다.",
    checkpoint: "끝 삽입과 중간 삽입의 복잡도가 다른 이유를 설명할 수 있다.",
    terms: ["array", "dynamic array", "index", "amortized"],
  },
  {
    id: "linked-list",
    phase: "structure",
    chapter: "§6",
    title: "연결 리스트",
    englishTitle: "Linked list · node · pointer",
    minutes: 24,
    summary: "노드와 연결을 통해 삽입 위치를 알고 있을 때의 강점을 이해합니다.",
    focus: "리스트 뒤집기에서 next_node를 먼저 저장하는 이유를 추적합니다.",
    checkpoint: "현재 연결을 잃지 않으려 next_node를 먼저 보관한다고 말할 수 있다.",
    terms: ["node", "next", "head", "pointer"],
  },
  {
    id: "stack",
    phase: "structure",
    chapter: "§7",
    title: "스택",
    englishTitle: "Stack · LIFO · push · pop",
    minutes: 18,
    summary: "가장 최근 상태를 먼저 꺼내야 할 때 쓰는 LIFO 구조입니다.",
    focus: "괄호 검사에서 열림·닫힘 상태를 스택에 어떻게 보관하는지 봅니다.",
    checkpoint: "괄호 검사에서 스택이 필요한 이유를 LIFO로 설명할 수 있다.",
    terms: ["LIFO", "push", "pop", "peek"],
  },
  {
    id: "queue-deque",
    phase: "structure",
    chapter: "§8",
    title: "큐와 덱",
    englishTitle: "Queue · deque · FIFO",
    minutes: 18,
    summary: "먼저 들어온 항목을 먼저 처리하는 FIFO 구조와 양끝 연산을 다룹니다.",
    focus: "list.pop(0) 대신 collections.deque.popleft를 선택하는 이유를 확인합니다.",
    checkpoint: "파이썬 큐에 deque를 쓰는 복잡도 이유를 말할 수 있다.",
    terms: ["FIFO", "enqueue", "dequeue", "popleft"],
  },
  {
    id: "hash-table",
    phase: "structure",
    chapter: "§9",
    title: "해시 테이블",
    englishTitle: "Hash table · dictionary · set",
    minutes: 22,
    summary: "키를 해시해 빠르게 찾고, 충돌과 해시 가능성의 조건을 이해합니다.",
    focus: "dict와 set의 역할을 비교하고 충돌이 왜 생기는지 확인합니다.",
    checkpoint: "dict와 set 중 무엇을 고를지 ‘값 필요 여부’로 판단할 수 있다.",
    terms: ["hash", "collision", "dictionary", "set"],
  },
  {
    id: "recursion",
    phase: "structure",
    chapter: "§10",
    title: "재귀와 호출 스택",
    englishTitle: "Recursion · call stack · base case",
    minutes: 21,
    summary: "재귀의 종료 조건과 호출 전·후 상태 변화를 호출 스택으로 읽습니다.",
    focus: "파이썬 재귀 깊이의 현실과 명시적 스택 버전의 필요를 구분합니다.",
    checkpoint: "재귀 함수의 필수 요소 두 가지를 말할 수 있다.",
    terms: ["base case", "recursive case", "call stack", "return"],
  },
  {
    id: "tree",
    phase: "structure",
    chapter: "§11",
    title: "트리와 순회",
    englishTitle: "Tree · traversal · binary tree",
    minutes: 28,
    summary: "계층 구조를 표현하고 전위·중위·후위·레벨 순회의 차이를 연결합니다.",
    focus: "각 순회가 ‘현재 노드를 언제 처리하는가’의 차이임을 봅니다.",
    checkpoint: "전위·중위·후위 순회의 방문 순서를 빈 트리에 적용할 수 있다.",
    terms: ["root", "leaf", "preorder", "inorder"],
  },
  {
    id: "bst-trie",
    phase: "structure",
    chapter: "§12–§12b",
    title: "BST와 트라이",
    englishTitle: "BST · trie · prefix tree",
    minutes: 30,
    summary: "정렬된 탐색의 불변식과 접두사 기반 검색 구조를 각각 익힙니다.",
    focus: "BST가 한쪽으로 치우치면 왜 O(n)이 되는지, 트라이가 무엇을 공유하는지 봅니다.",
    checkpoint: "BST의 왼쪽·오른쪽 규칙을 불변식으로 설명할 수 있다.",
    terms: ["binary search tree", "prefix", "child", "height"],
  },
  {
    id: "heap",
    phase: "structure",
    chapter: "§13",
    title: "힙과 우선순위 큐",
    englishTitle: "Heap · priority queue · heapq",
    minutes: 22,
    summary: "가장 작은(또는 큰) 값을 빠르게 꺼낼 수 있도록 배열로 완전 이진 트리를 표현합니다.",
    focus: "최소 힙 불변식과 부모·자식 인덱스 관계를 heapq에 연결합니다.",
    checkpoint: "힙과 정렬된 배열의 목적 차이를 설명할 수 있다.",
    terms: ["min heap", "priority queue", "heappush", "heappop"],
  },
  {
    id: "graph",
    phase: "structure",
    chapter: "§14",
    title: "그래프 표현",
    englishTitle: "Graph · vertex · edge · adjacency",
    minutes: 23,
    summary: "정점과 간선의 관계를 인접 리스트·인접 행렬로 표현하는 방법을 비교합니다.",
    focus: "희소 그래프와 조밀 그래프에서 어떤 표현이 유리한지 판단합니다.",
    checkpoint: "인접 리스트와 행렬의 공간 복잡도를 비교할 수 있다.",
    terms: ["vertex", "edge", "adjacency list", "adjacency matrix"],
  },
  {
    id: "dfs-bfs",
    phase: "algorithm",
    chapter: "§15",
    title: "DFS와 BFS",
    englishTitle: "Depth-first · breadth-first search",
    minutes: 30,
    summary: "깊이 우선과 너비 우선의 처리 순서, 방문 처리 시점, 최단 거리 조건을 다룹니다.",
    focus: "BFS는 큐에 넣을 때 방문 처리하고, 동일 비용 간선에서 최단 거리를 보장합니다.",
    checkpoint: "모든 간선 비용이 같을 때 BFS를 고르는 이유를 설명할 수 있다.",
    terms: ["DFS", "BFS", "visited", "frontier"],
  },
  {
    id: "sorting",
    phase: "algorithm",
    chapter: "§16",
    title: "정렬 알고리즘",
    englishTitle: "Sorting · stable · in-place",
    minutes: 35,
    summary: "선택·삽입·병합·버블·퀵·힙 정렬의 진행 방식과 특성을 비교합니다.",
    focus: "안정 정렬, 제자리 정렬, 평균·최악 복잡도를 각각 구분합니다.",
    checkpoint: "병합 정렬과 퀵 정렬의 분할 방식 차이를 말할 수 있다.",
    terms: ["stable sort", "in-place", "merge", "partition"],
  },
  {
    id: "binary-search",
    phase: "algorithm",
    chapter: "§17",
    title: "이진 탐색",
    englishTitle: "Binary search · boundary · parametric search",
    minutes: 25,
    summary: "정답 후보 구간이라는 불변식을 유지하며 절반을 제거하는 방법입니다.",
    focus: "left <= right, 경계 찾기, 매개변수 탐색을 각각 같은 틀로 읽습니다.",
    checkpoint: "정렬되지 않은 데이터에는 일반 이진 탐색을 바로 쓸 수 없다고 말할 수 있다.",
    terms: ["left", "right", "mid", "monotonic"],
  },
  {
    id: "range-patterns",
    phase: "algorithm",
    chapter: "§18",
    title: "투 포인터와 슬라이딩 윈도우",
    englishTitle: "Two pointers · sliding window",
    minutes: 22,
    summary: "구간을 다시 처음부터 계산하지 않고 포인터를 움직여 상태를 갱신합니다.",
    focus: "정렬 여부·조건의 단조성·윈도우에 유지할 값을 먼저 확인합니다.",
    checkpoint: "슬라이딩 윈도우 한 바퀴에서 오른쪽 추가와 왼쪽 제거의 역할을 말할 수 있다.",
    terms: ["window", "left pointer", "right pointer", "range"],
  },
  {
    id: "backtracking-divide",
    phase: "algorithm",
    chapter: "§19–§20",
    title: "백트래킹과 분할 정복",
    englishTitle: "Backtracking · divide and conquer",
    minutes: 28,
    summary: "선택을 되돌리며 탐색하거나, 문제를 독립 부분으로 나눠 합치는 전략을 비교합니다.",
    focus: "path.copy의 필요와 가지치기, 분할 정복과 DP의 차이를 확인합니다.",
    checkpoint: "백트래킹에서 상태 복구가 필요한 이유를 코드 흐름으로 설명할 수 있다.",
    terms: ["backtrack", "prune", "divide", "combine"],
  },
  {
    id: "greedy-dp",
    phase: "algorithm",
    chapter: "§21–§22",
    title: "그리디와 동적 계획법",
    englishTitle: "Greedy · dynamic programming",
    minutes: 35,
    summary: "매 순간의 선택을 증명해야 하는 그리디와, 부분 문제를 저장하는 DP를 구분합니다.",
    focus: "반례를 찾는 습관, DP 상태·점화식·초기값을 다섯 질문으로 정리합니다.",
    checkpoint: "DP를 시작할 때 상태 정의를 먼저 적어야 하는 이유를 설명할 수 있다.",
    terms: ["greedy choice", "counterexample", "memoization", "tabulation"],
  },
  {
    id: "topological",
    phase: "algorithm",
    chapter: "§23",
    title: "위상 정렬",
    englishTitle: "Topological sort · DAG · indegree",
    minutes: 20,
    summary: "선행 관계가 있는 작업을 방향 비순환 그래프의 규칙에 맞춰 배치합니다.",
    focus: "진입 차수 0인 노드를 큐에 넣는 Kahn 알고리즘을 추적합니다.",
    checkpoint: "결과 길이가 정점 수보다 작으면 사이클이 있다는 이유를 설명할 수 있다.",
    terms: ["DAG", "indegree", "dependency", "Kahn"],
  },
  {
    id: "shortest-path",
    phase: "algorithm",
    chapter: "§24",
    title: "최단 경로",
    englishTitle: "Shortest path · Dijkstra · Floyd-Warshall",
    minutes: 30,
    summary: "간선 비용 조건에 따라 BFS·다익스트라·벨만-포드·플로이드를 구분합니다.",
    focus: "다익스트라에서 오래된 힙 항목을 건너뛰는 이유와 음수 간선의 한계를 봅니다.",
    checkpoint: "음수 간선이 있으면 다익스트라의 확정 논리가 깨짐을 설명할 수 있다.",
    terms: ["relaxation", "distance", "stale entry", "weight"],
  },
  {
    id: "union-mst",
    phase: "algorithm",
    chapter: "§25–§26",
    title: "유니온 파인드와 MST",
    englishTitle: "Disjoint set · union-find · MST",
    minutes: 27,
    summary: "집합을 합치고 대표를 찾는 구조를 사이클 판별과 최소 신장 트리에 연결합니다.",
    focus: "경로 압축, union by rank, 크루스칼과 프림의 선택 기준을 확인합니다.",
    checkpoint: "MST와 최단 경로가 해결하는 대상이 다름을 설명할 수 있다.",
    terms: ["find", "union", "path compression", "Kruskal"],
  },
  {
    id: "code-reading",
    phase: "practice",
    chapter: "§27–§29",
    title: "코드 독해 절차",
    englishTitle: "Code reading · contract · state trace",
    minutes: 25,
    summary: "함수 계약, 상태 변수, 반복 한 바퀴의 목적, 종료 조건, 작은 예제 추적 순으로 읽습니다.",
    focus: "변수 이름을 번역하고 결과가 아니라 매 순간 바뀌는 상태를 표로 만듭니다.",
    checkpoint: "코드를 볼 때 가장 먼저 입력·출력·원본 수정 여부를 확인할 수 있다.",
    terms: ["contract", "state", "predecessor", "successor"],
  },
  {
    id: "python-pitfalls",
    phase: "practice",
    chapter: "§30",
    title: "파이썬 구현 실수 점검",
    englishTitle: "Python pitfalls · aliasing · identity",
    minutes: 20,
    summary: "얕은 복사, 방문 처리, is와 ==, 변경 가능한 기본 인자 등 반복되는 실수를 막습니다.",
    focus: "코드를 제출하기 전 원본 변경·경계·힙 오래된 항목을 점검하는 습관을 만듭니다.",
    checkpoint: "기본 인자에 [] 대신 None을 쓰는 이유를 설명할 수 있다.",
    terms: ["shallow copy", "identity", "default argument", "aliasing"],
  },
  {
    id: "engineer-path",
    phase: "practice",
    chapter: "§31–§35",
    title: "정보처리기사 연결과 학습 루틴",
    englishTitle: "Engineer exam · routine · self-check",
    minutes: 24,
    summary: "전공 개념의 깊이와 기사 시험 범위를 구분하고, 4일 단원 루틴으로 반복합니다.",
    focus: "코드 독해·C/Java 비교·기사 과목을 블록 단위로 병행하는 길을 정합니다.",
    checkpoint: "문제 조건, 핵심 연산, 불변식, 복잡도, 한계를 한 답변 틀로 말할 수 있다.",
    terms: ["trace", "exam scope", "routine", "self-check"],
  },
]

const PHASE_QUIZZES: Record<PhaseId, Quiz[]> = {
  foundation: [
    {
      chapter: "기초 점검 · 불변식",
      question: "이진 탐색에서 left와 right가 유지하는 핵심 규칙은 무엇일까요?",
      options: ["항상 같은 값을 가리킨다", "정답 후보가 남아 있을 수 있는 구간이다", "이미 정렬된 원소의 개수다", "방문하지 않은 정점의 개수다"],
      answer: 1,
      explanation: "mid 공식 자체보다 ‘정답이 존재할 수 있는 후보 구간’을 유지하며 불가능한 절반을 제거하는 불변식이 핵심입니다.",
    },
    {
      chapter: "기초 점검 · 파이썬",
      question: "BFS용 큐에서 list.pop(0) 대신 deque.popleft()를 쓰는 가장 직접적인 이유는 무엇일까요?",
      options: ["deque는 원소를 자동 정렬해서", "앞에서 꺼내는 연산이 O(1)이라서", "list는 방문 배열을 만들 수 없어서", "deque만 그래프를 담을 수 있어서"],
      answer: 1,
      explanation: "list의 맨 앞 삭제는 뒤 원소를 당겨야 해 O(n)이고, deque의 popleft는 양끝 연산을 O(1)로 처리합니다.",
    },
    {
      chapter: "기초 점검 · 복잡도",
      question: "i가 매 반복마다 2배가 될 때, i가 n을 넘기까지의 반복 횟수는 어떤 증가율일까요?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
      answer: 1,
      explanation: "1, 2, 4, 8처럼 두 배씩 커지면 약 log₂n번만 반복합니다. 반복문 모양을 증가율로 읽는 연습이 중요합니다.",
    },
  ],
  structure: [
    {
      chapter: "자료구조 점검 · 선택",
      question: "키에 대응하는 값을 빠르게 찾고 싶을 때 가장 먼저 검토할 파이썬 구조는 무엇일까요?",
      options: ["list", "dict", "tuple", "str"],
      answer: 1,
      explanation: "dict는 키-값 대응을 위한 해시 테이블입니다. 값이 필요 없고 존재 여부만 중요하면 set을 함께 비교해 보세요.",
    },
    {
      chapter: "자료구조 점검 · 트리",
      question: "BST에서 어떤 값이 현재 노드보다 작을 때, 탐색은 어느 방향으로 이어져야 할까요?",
      options: ["왼쪽 서브트리", "오른쪽 서브트리", "항상 루트", "무작위 자식"],
      answer: 0,
      explanation: "BST의 불변식은 왼쪽에는 더 작은 값, 오른쪽에는 더 큰 값이 있다는 것입니다. 이 규칙이 검색 경로를 줄입니다.",
    },
    {
      chapter: "자료구조 점검 · 힙",
      question: "최소 힙에서 가장 먼저 꺼낼 수 있도록 보장되는 값은 무엇일까요?",
      options: ["마지막에 넣은 값", "전체에서 가장 작은 값", "중앙값", "정렬된 두 번째 값"],
      answer: 1,
      explanation: "힙은 전체 정렬이 아니라 우선순위가 가장 높은 한 원소를 빠르게 꺼내는 데 초점을 둡니다.",
    },
  ],
  algorithm: [
    {
      chapter: "알고리즘 점검 · 탐색",
      question: "일반 BFS가 시작점에서의 최단 거리를 보장하는 조건은 무엇일까요?",
      options: ["그래프가 반드시 트리여야 한다", "간선 비용이 모두 같아야 한다", "정점 수가 100개 이하여야 한다", "재귀로 구현해야 한다"],
      answer: 1,
      explanation: "한 번의 이동 비용이 같을 때 BFS는 거리가 가까운 상태부터 순서대로 처리합니다. 가중치가 다르면 다익스트라 등을 검토해야 합니다.",
    },
    {
      chapter: "알고리즘 점검 · DP",
      question: "동적 계획법을 설계할 때 가장 먼저 분명하게 적어야 할 것은 무엇일까요?",
      options: ["정렬 순서", "상태의 의미", "입력의 파일 이름", "재귀 제한 값"],
      answer: 1,
      explanation: "DP는 dp[i] 등이 정확히 무엇을 뜻하는지 상태 정의를 세운 뒤, 점화식·초기값·계산 순서를 정해야 흔들리지 않습니다.",
    },
    {
      chapter: "알고리즘 점검 · 최단 경로",
      question: "음수 간선이 있으면 다익스트라를 그대로 쓰기 어려운 이유는 무엇일까요?",
      options: ["그래프를 저장할 수 없어서", "나중 경로가 확정 거리를 더 줄일 수 있어서", "힙을 쓸 수 없어서", "정점 수가 두 배가 되어서"],
      answer: 1,
      explanation: "다익스트라는 가장 짧은 후보를 꺼냈을 때 거리를 확정한다는 성질을 씁니다. 음수 간선은 그 확정을 뒤집을 수 있습니다.",
    },
  ],
  practice: [
    {
      chapter: "실전 점검 · 코드 독해",
      question: "처음 보는 알고리즘 함수를 읽을 때 가장 먼저 확인할 정보는 무엇일까요?",
      options: ["변수 이름의 길이", "입력·출력·원본 수정 여부", "주석 개수", "함수의 줄 수"],
      answer: 1,
      explanation: "함수 계약을 먼저 알면 이후 상태 변수와 반복문의 목적을 훨씬 안정적으로 추적할 수 있습니다.",
    },
    {
      chapter: "실전 점검 · 파이썬 실수",
      question: "기본 인자로 [] 대신 None을 두고 함수 안에서 리스트를 만드는 이유는 무엇일까요?",
      options: ["None이 더 빠르기 때문에", "호출 사이에 같은 리스트가 공유되는 것을 막기 위해", "빈 리스트를 정렬하기 위해", "타입 오류를 피하기 위해"],
      answer: 1,
      explanation: "변경 가능한 기본 객체는 함수 호출 사이에 재사용됩니다. None을 센티널로 두면 호출마다 새 리스트를 만들 수 있습니다.",
    },
    {
      chapter: "실전 점검 · 설명",
      question: "개념을 설명할 때 알고리즘 이름만 말하는 대신 함께 말해야 할 정보는 무엇일까요?",
      options: ["개발자 이름", "문제 조건·핵심 연산·불변식·복잡도·한계", "코드 줄 수", "입력 파일 확장자"],
      answer: 1,
      explanation: "이 다섯 연결을 말할 수 있으면 이름 암기가 아니라 실제 선택과 구현으로 이어지는 이해가 됩니다.",
    },
  ],
}

const EMPTY_PROGRESS: SavedProgress = {
  completedIds: [],
  lastStudiedId: null,
  quizCorrectCount: 0,
  quizAttemptCount: 0,
  practiceStepsByModule: {},
  activityByDate: {},
}

const EMPTY_ACTIVITY: StudyActivity = {
  practice: 0,
  quiz: 0,
  complete: 0,
}

function getKoreanDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getRecentKoreanDateKeys(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - (days - index - 1))
    return getKoreanDateKey(date)
  })
}

function getActivityTotal(activity: StudyActivity | undefined) {
  if (!activity) return 0
  return activity.practice + activity.quiz + activity.complete
}

function recordStudyActivity(progress: SavedProgress, kind: StudyActivityKind): SavedProgress {
  const dateKey = getKoreanDateKey()
  const current = progress.activityByDate[dateKey] ?? EMPTY_ACTIVITY
  const nextActivityByDate = {
    ...progress.activityByDate,
    [dateKey]: {
      ...current,
      [kind]: current[kind] + 1,
    },
  }
  const recentEntries = Object.entries(nextActivityByDate)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-28)

  return {
    ...progress,
    activityByDate: Object.fromEntries(recentEntries),
  }
}

function getStorageKey(userId: string) {
  return `nadeul-algorithm-study-progress:v1:${userId}`
}

function sanitizeProgress(value: unknown): SavedProgress {
  if (!value || typeof value !== "object") {
    return EMPTY_PROGRESS
  }

  const source = value as Partial<SavedProgress>
  const activityByDate = source.activityByDate && typeof source.activityByDate === "object"
    ? Object.fromEntries(
        Object.entries(source.activityByDate)
          .flatMap(([date, activity]): Array<[string, StudyActivity]> => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !activity || typeof activity !== "object") return []
            const item = activity as Partial<StudyActivity>
            const safeActivity: StudyActivity = {
              practice: typeof item.practice === "number" && Number.isFinite(item.practice) ? Math.max(0, Math.floor(item.practice)) : 0,
              quiz: typeof item.quiz === "number" && Number.isFinite(item.quiz) ? Math.max(0, Math.floor(item.quiz)) : 0,
              complete: typeof item.complete === "number" && Number.isFinite(item.complete) ? Math.max(0, Math.floor(item.complete)) : 0,
            }
            return [[date, safeActivity]]
          })
          .sort(([left], [right]) => left.localeCompare(right))
          .slice(-28)
      )
    : {}

  return {
    completedIds: Array.isArray(source.completedIds)
      ? source.completedIds.filter((id): id is string => typeof id === "string" && STUDY_MODULES.some((module) => module.id === id))
      : [],
    lastStudiedId: typeof source.lastStudiedId === "string" && STUDY_MODULES.some((module) => module.id === source.lastStudiedId)
      ? source.lastStudiedId
      : null,
    quizCorrectCount: typeof source.quizCorrectCount === "number" && Number.isFinite(source.quizCorrectCount)
      ? Math.max(0, Math.floor(source.quizCorrectCount))
      : 0,
    quizAttemptCount: typeof source.quizAttemptCount === "number" && Number.isFinite(source.quizAttemptCount)
      ? Math.max(0, Math.floor(source.quizAttemptCount))
      : 0,
    practiceStepsByModule: source.practiceStepsByModule && typeof source.practiceStepsByModule === "object"
      ? Object.fromEntries(
          Object.entries(source.practiceStepsByModule).flatMap(([moduleId, stepIds]) => {
            if (!STUDY_MODULES.some((module) => module.id === moduleId) || !Array.isArray(stepIds)) return []
            const safeStepIds = stepIds.filter((stepId): stepId is PracticeStepId =>
              typeof stepId === "string" && PRACTICE_STEPS.some((step) => step.id === stepId)
            )
            return [[moduleId, [...new Set(safeStepIds)]]]
          })
        )
      : {},
    activityByDate,
  }
}

export default function AlgorithmStudyPage() {
  const router = useRouter()
  const { user, status } = useAuth()
  const [progress, setProgress] = useState<SavedProgress>(EMPTY_PROGRESS)
  const [loadedProgressOwnerId, setLoadedProgressOwnerId] = useState<string | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<PhaseId | "all">("all")
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [quizIndex, setQuizIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [quizChecked, setQuizChecked] = useState(false)

  useEffect(() => {
    if (status === "guest") {
      const timeout = window.setTimeout(() => router.replace("/login"), 450)
      return () => window.clearTimeout(timeout)
    }
  }, [router, status])

  useEffect(() => {
    if (!user) return

    setLoadedProgressOwnerId(null)
    try {
      const saved = window.localStorage.getItem(getStorageKey(user.id))
      setProgress(saved ? sanitizeProgress(JSON.parse(saved)) : EMPTY_PROGRESS)
    } catch {
      setProgress(EMPTY_PROGRESS)
    } finally {
      setLoadedProgressOwnerId(user.id)
    }
  }, [user])

  useEffect(() => {
    if (!user || loadedProgressOwnerId !== user.id) return
    try {
      window.localStorage.setItem(getStorageKey(user.id), JSON.stringify(progress))
    } catch {
      // The study path remains usable when browser storage is unavailable.
    }
  }, [loadedProgressOwnerId, progress, user])

  const completedSet = useMemo(() => new Set(progress.completedIds), [progress.completedIds])
  const nextModule = useMemo(
    () => STUDY_MODULES.find((module) => !completedSet.has(module.id)) ?? STUDY_MODULES.at(-1)!,
    [completedSet]
  )
  const resumeModule = useMemo(() => {
    if (progress.lastStudiedId && !completedSet.has(progress.lastStudiedId)) {
      return STUDY_MODULES.find((module) => module.id === progress.lastStudiedId) ?? nextModule
    }
    return nextModule
  }, [completedSet, nextModule, progress.lastStudiedId])
  const selectedModule = useMemo(
    () => STUDY_MODULES.find((module) => module.id === selectedModuleId) ?? nextModule,
    [nextModule, selectedModuleId]
  )
  const visibleModules = useMemo(
    () => selectedPhase === "all" ? STUDY_MODULES : STUDY_MODULES.filter((module) => module.phase === selectedPhase),
    [selectedPhase]
  )
  const completionPercent = Math.round((completedSet.size / STUDY_MODULES.length) * 100)
  const currentPhase = PHASES.find((phase) => phase.id === selectedModule.phase)!
  const phaseQuizzes = PHASE_QUIZZES[selectedModule.phase]
  const activeQuiz = phaseQuizzes[quizIndex % phaseQuizzes.length]
  const selectedPracticeSteps = progress.practiceStepsByModule[selectedModule.id] ?? []
  const practicePercent = Math.round((selectedPracticeSteps.length / PRACTICE_STEPS.length) * 100)
  const quizAccuracy = progress.quizAttemptCount > 0
    ? Math.round((progress.quizCorrectCount / progress.quizAttemptCount) * 100)
    : null
  const learningCurve = useMemo(
    () => getRecentKoreanDateKeys(7).map((date) => ({ date, activity: progress.activityByDate[date] ?? EMPTY_ACTIVITY })),
    [progress.activityByDate]
  )
  const learningCurveMaximum = Math.max(1, ...learningCurve.map(({ activity }) => getActivityTotal(activity)))
  const weeklyActivityTotal = learningCurve.reduce((total, { activity }) => total + getActivityTotal(activity), 0)
  const todayActivityTotal = getActivityTotal(progress.activityByDate[getKoreanDateKey()])

  const focusModule = (moduleId: string) => {
    setSelectedModuleId(moduleId)
    setQuizIndex(0)
    setSelectedOption(null)
    setQuizChecked(false)
    setProgress((previous) => ({ ...previous, lastStudiedId: moduleId }))
    window.requestAnimationFrame(() => document.getElementById("study-focus")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  const toggleModuleCompletion = (moduleId: string) => {
    setProgress((previous) => {
      const isCompleted = previous.completedIds.includes(moduleId)
      const nextProgress = {
        ...previous,
        lastStudiedId: moduleId,
        completedIds: isCompleted
          ? previous.completedIds.filter((id) => id !== moduleId)
          : [...previous.completedIds, moduleId],
      }
      return isCompleted ? nextProgress : recordStudyActivity(nextProgress, "complete")
    })
  }

  const checkQuiz = () => {
    if (selectedOption == null || quizChecked) return
    setQuizChecked(true)
    setProgress((previous) => recordStudyActivity({
      ...previous,
      quizAttemptCount: previous.quizAttemptCount + 1,
      quizCorrectCount: previous.quizCorrectCount + (selectedOption === activeQuiz.answer ? 1 : 0),
    }, "quiz"))
  }

  const moveToNextQuiz = () => {
    setQuizIndex((previous) => (previous + 1) % phaseQuizzes.length)
    setSelectedOption(null)
    setQuizChecked(false)
  }

  const togglePracticeStep = (stepId: PracticeStepId) => {
    setProgress((previous) => {
      const current = previous.practiceStepsByModule[selectedModule.id] ?? []
      const nextSteps = current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId]

      const nextProgress = {
        ...previous,
        lastStudiedId: selectedModule.id,
        practiceStepsByModule: {
          ...previous.practiceStepsByModule,
          [selectedModule.id]: nextSteps,
        },
      }
      return current.includes(stepId) ? nextProgress : recordStudyActivity(nextProgress, "practice")
    })
  }

  const openStudyCoach = (request: string) => {
    const lastQuizAttempt = quizChecked && selectedOption != null
      ? [
          "[최근 개념 점검]",
          `문제: ${activeQuiz.question}`,
          `내가 고른 답: ${activeQuiz.options[selectedOption]}`,
          `정답: ${activeQuiz.options[activeQuiz.answer]}`,
        ].join("\n")
      : null

    const draft = [
      "[알고리즘 학습 맥락]",
      `현재 단원: ${selectedModule.chapter} ${selectedModule.title}`,
      `학습 단계: ${currentPhase.title}`,
      `핵심 초점: ${selectedModule.focus}`,
      `완료 기준: ${selectedModule.checkpoint}`,
      `핵심 용어: ${selectedModule.terms.join(", ")}`,
      `수행한 학습 패턴: ${selectedPracticeSteps.length}/4`,
      lastQuizAttempt,
      "",
      "[내 요청]",
      request,
      "",
      "답변은 한국어로, 먼저 내 생각을 확인하는 질문 1개를 던진 뒤 설명·예시·다음 행동 순서로 도와줘.",
    ].filter((part): part is string => Boolean(part)).join("\n")

    try {
      saveLabAiChatStudyDraft(window.sessionStorage, draft)
    } catch {
      // Storage may be unavailable in privacy-restricted browsers; chat still opens normally.
    }
    router.push("/lab/ai-chat")
  }

  const startExamTrack = (track: ExamTrack) => {
    if (track.phase) {
      const phaseModules = STUDY_MODULES.filter((module) => module.phase === track.phase)
      const target = phaseModules.find((module) => !completedSet.has(module.id)) ?? phaseModules[0]
      if (target) {
        setSelectedPhase(track.phase)
        focusModule(target.id)
      }
      return
    }

    if (track.request) openStudyCoach(track.request)
  }

  const resetProgress = () => {
    if (!window.confirm("이 브라우저에 저장된 알고리즘 학습 진도를 초기화할까요?")) return
    setProgress(EMPTY_PROGRESS)
    setSelectedModuleId(null)
    setQuizIndex(0)
    setSelectedOption(null)
    setQuizChecked(false)
  }

  if (status === "loading") {
    return <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-base font-bold text-sky-blue">실험실을 불러오는 중...</main>
  }

  if (status === "guest" || !user) {
    return <main className="flex min-h-screen items-center justify-center px-4 pt-24 text-center text-base font-bold text-sky-blue">로그인이 필요합니다. 로그인 페이지로 이동합니다.</main>
  }

  if (!user.labEnabled) {
    return (
      <main className="min-h-screen bg-background px-4 pb-14 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionCard>
            <div className="space-y-4 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                <FlaskConical className="size-3.5" /> experimental lab
              </span>
              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">실험실 기능이 꺼져 있어요.</h1>
              <p className="mx-auto max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">대시보드 프로필 설정에서 ‘실험실 기능 활성화’를 켜면 학습 경로를 사용할 수 있습니다.</p>
              <Link href="/dashboard" className="inline-flex min-h-10 items-center justify-center rounded-[1.25rem] border border-sky-blue/30 bg-sky-blue/10 px-5 py-3 text-base font-black text-sky-blue transition-[border-color,background-color,transform] hover:border-sky-blue hover:bg-sky-blue/20 active:scale-[0.96]">
                대시보드로 이동
              </Link>
            </div>
          </SectionCard>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
        <SectionCard panelClassName="overflow-hidden">
          <div className="relative space-y-5">
            <div className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-sky-blue/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-active-blue">
                  <GraduationCap className="size-3.5" /> personal study lab
                </span>
                <div className="space-y-2">
                  <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">파이썬 알고리즘 학습 경로</h1>
                  <p className="text-base leading-8 text-muted-foreground sm:text-lg">개념서의 순서를 따라, 용어·상태 변화·불변식·복잡도를 문제 풀이까지 연결하는 개인 학습 공간입니다.</p>
                </div>
                <p className="inline-flex max-w-2xl items-start gap-2 rounded-[1.15rem] border border-sky-blue/20 bg-sky-blue/8 px-4 py-3 text-sm font-semibold leading-6 text-foreground/90">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-sky-blue" />
                  진도와 점검 결과는 현재 브라우저에만 저장됩니다. 오늘은 한 단원과 한 개념 점검이면 충분해요.
                </p>
              </div>
              <ShimmerButton type="button" onClick={() => focusModule(resumeModule.id)} className="min-h-11 w-full rounded-[1.15rem] px-5 py-3 text-sm font-black active:scale-[0.96] sm:w-auto sm:shrink-0">
                이어서 학습하기 <ArrowRight className="ml-2 size-4" />
              </ShimmerButton>
            </div>
          </div>
        </SectionCard>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="학습 현황">
          <StatusMetric label="전체 진도" value={`${completionPercent}%`} meta={`${completedSet.size}/${STUDY_MODULES.length} 단원 완료`} compact icon={<Target className="size-4" />} />
          <StatusMetric label="다음 단원" value={nextModule.chapter} meta={nextModule.title} compact icon={<Route className="size-4" />} />
          <StatusMetric label="이번 세션" value={`${selectedPracticeSteps.length}/4`} meta={`${selectedModule.title} 패턴 수행`} compact icon={<ListChecks className="size-4" />} />
          <StatusMetric label="개념 점검" value={quizAccuracy == null ? "시작 전" : `${quizAccuracy}%`} meta={quizAccuracy == null ? "답을 고르면 기록됩니다" : `${progress.quizAttemptCount}회 시도`} compact icon={<BrainCircuit className="size-4" />} />
        </section>

        <SectionCard panelClassName="overflow-hidden">
          <div className="relative space-y-4">
            <div className="pointer-events-none absolute -left-12 top-0 size-40 rounded-full bg-active-blue/8 blur-3xl" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">learning curve · recent 7 days</p>
                <h2 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">작은 학습 기록이 쌓이는 곡선</h2>
                <p className="text-sm leading-6 text-muted-foreground">패턴 수행·개념 점검·단원 완료를 기록합니다. 양보다 끊기지 않는 리듬을 확인하세요.</p>
              </div>
              <div className="flex gap-2 self-start sm:self-auto" aria-label="최근 학습 기록 요약">
                <span className="rounded-full border border-active-blue/20 bg-active-blue/8 px-3 py-1.5 text-xs font-black text-active-blue">오늘 {todayActivityTotal}회</span>
                <span className="rounded-full border border-card-border/70 bg-background/70 px-3 py-1.5 text-xs font-black text-muted-foreground">7일 {weeklyActivityTotal}회</span>
              </div>
            </div>
            <div className="relative grid h-36 grid-cols-7 items-end gap-2 rounded-[1.4rem] border border-card-border/70 bg-background/55 p-3 sm:h-40 sm:gap-3 sm:p-4" aria-label="최근 7일 학습 곡선">
              {learningCurve.map(({ date, activity }) => {
                const total = getActivityTotal(activity)
                const height = total === 0 ? 5 : Math.max(14, Math.round((total / learningCurveMaximum) * 100))
                const label = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" }).format(new Date(`${date}T12:00:00+09:00`))
                return (
                  <div key={date} className="flex h-full min-w-0 flex-col justify-end gap-2 text-center">
                    <span className="text-[11px] font-black tabular-nums text-muted-foreground">{total || "·"}</span>
                    <div className="flex h-20 items-end justify-center rounded-lg bg-muted/45 px-1 sm:h-24" title={`${date}: 패턴 ${activity.practice}, 점검 ${activity.quiz}, 완료 ${activity.complete}`}>
                      <div className="w-full max-w-8 rounded-t-md bg-linear-to-t from-active-blue to-sky-blue transition-[height] duration-300" style={{ height: `${height}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
                  </div>
                )
              })}
            </div>
            <p className="relative text-xs font-semibold leading-5 text-muted-foreground">한 칸을 완료하거나 문제 한 개를 풀면 충분합니다. 이 그래프는 브라우저에만 저장되며, 시간에 따라 자동으로 요청을 보내지 않습니다.</p>
          </div>
        </SectionCard>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] xl:gap-6">
          <SectionCard className="scroll-mt-28" panelClassName="h-full" contentClassName="h-full" >
            <div id="study-focus" className="flex h-full flex-col space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-muted-foreground">오늘의 학습 초점</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-3 py-1.5 text-xs font-black", currentPhase.tone)}>{currentPhase.order} · {currentPhase.title}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Clock3 className="size-3.5" /> 약 {selectedModule.minutes}분</span>
                  </div>
                </div>
                {completedSet.has(selectedModule.id) ? (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-[1rem] border border-nature-green/25 bg-nature-green/10 px-3 text-sm font-black text-nature-green"><CheckCircle2 className="size-4" /> 완료</span>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-black text-sky-blue">{selectedModule.chapter}</p>
                <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{selectedModule.title}</h2>
                <p className="text-sm font-semibold tracking-wide text-muted-foreground">{selectedModule.englishTitle}</p>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground">{selectedModule.summary}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] border border-card-border/70 bg-background/75 p-4 shadow-[0_8px_24px_rgba(17,32,39,0.04)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">오늘 볼 것</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-foreground/90">{selectedModule.focus}</p>
                </div>
                <div className="rounded-[1.35rem] border border-nature-green/20 bg-nature-green/7 p-4 shadow-[0_8px_24px_rgba(11,125,113,0.05)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-nature-green">완료 기준</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-foreground/90">{selectedModule.checkpoint}</p>
                </div>
              </div>

              <section className="rounded-[1.6rem] border border-card-border/70 bg-background/55 p-3.5 shadow-[0_10px_28px_rgba(17,32,39,0.04)] sm:p-4" aria-label="학습 패턴">
                <div className="flex flex-wrap items-end justify-between gap-2 px-1 pb-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">active learning pattern</p>
                    <p className="mt-1 text-sm font-black text-foreground">읽고 · 추적하고 · 회상하고 · 구현하기</p>
                  </div>
                  <span className="rounded-full bg-card px-2.5 py-1 text-xs font-black text-sky-blue tabular-nums">{selectedPracticeSteps.length}/4 수행</span>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {PRACTICE_STEPS.map((step, index) => {
                    const isDone = selectedPracticeSteps.includes(step.id)
                    return (
                      <button
                        key={step.id}
                        type="button"
                        aria-pressed={isDone}
                        onClick={() => togglePracticeStep(step.id)}
                        className={cn(
                          "group min-h-32 rounded-[1.2rem] border p-3 text-left transition-[background-color,border-color,color,transform,box-shadow] active:scale-[0.96]",
                          isDone
                            ? "border-nature-green/30 bg-nature-green/10 text-foreground shadow-[0_8px_20px_rgba(11,125,113,0.08)]"
                            : "border-card-border/70 bg-card/70 text-foreground hover:border-sky-blue/30 hover:bg-sky-blue/5"
                        )}
                      >
                        <span className={cn("flex size-7 items-center justify-center rounded-full border text-xs font-black transition-[background-color,color,transform]", isDone ? "border-nature-green/35 bg-nature-green text-accent-foreground" : "border-card-border/70 bg-background text-muted-foreground group-hover:border-sky-blue/30 group-hover:text-sky-blue")}>{isDone ? <Check className="size-3.5" /> : index + 1}</span>
                        <span className="mt-3 block text-xs font-black text-sky-blue">{step.duration}</span>
                        <span className="mt-1 block text-sm font-black leading-5">{step.label}</span>
                        <span className="mt-1 block text-[11px] font-semibold leading-5 text-muted-foreground">{step.description}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/80" aria-label={`학습 패턴 ${practicePercent}% 완료`}>
                  <div className="h-full rounded-full bg-linear-to-r from-nature-green to-sky-blue transition-[width] duration-300" style={{ width: `${practicePercent}%` }} />
                </div>
              </section>

              <div className="mt-auto flex flex-col gap-3 border-t border-card-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2" aria-label="핵심 용어">
                  {selectedModule.terms.map((term) => <span key={term} className="rounded-full border border-card-border/70 bg-card/70 px-2.5 py-1 text-xs font-bold text-muted-foreground">{term}</span>)}
                </div>
                <button type="button" onClick={() => toggleModuleCompletion(selectedModule.id)} className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-[1rem] border px-4 py-2.5 text-sm font-black transition-[background-color,border-color,color,transform] active:scale-[0.96]", completedSet.has(selectedModule.id) ? "border-card-border bg-background text-muted-foreground hover:bg-muted/50" : "border-nature-green/30 bg-nature-green/10 text-nature-green hover:border-nature-green/50 hover:bg-nature-green/15")}>
                  {completedSet.has(selectedModule.id) ? <><RotateCcw className="size-4" /> 완료 취소</> : <><Check className="size-4" /> {selectedPracticeSteps.length === 4 ? "이 단원 완료" : `패턴 ${selectedPracticeSteps.length}/4 · 완료`}</>}
                </button>
              </div>
            </div>
          </SectionCard>

          <MagicCard className="overflow-hidden rounded-[2rem] xl:sticky xl:top-28 xl:self-start" gradientSize={220} gradientOpacity={0.64}>
            <div className="relative rounded-[2rem] border border-card-border/70 bg-card/90 p-4 backdrop-blur-2xl sm:p-6">
              <BorderBeam size={160} duration={12} colorFrom="var(--beam-from)" colorTo="var(--beam-to)" />
              <div className="relative z-10 flex flex-col space-y-4 sm:space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-active-blue/25 bg-active-blue/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-active-blue"><BrainCircuit className="size-3.5" /> concept check</span>
                    <span className="rounded-full bg-background/80 px-2.5 py-1 text-xs font-black text-muted-foreground tabular-nums">{quizIndex % phaseQuizzes.length + 1}/{phaseQuizzes.length}</span>
                  </div>
                  <p className="text-sm font-bold text-sky-blue">{currentPhase.title} · {activeQuiz.chapter}</p>
                  <h2 className="text-lg font-black leading-7 text-foreground sm:text-xl sm:leading-8">{activeQuiz.question}</h2>
                  <p className="text-xs font-semibold leading-5 text-muted-foreground">답을 고르기 전에, 근거가 되는 규칙을 한 문장으로 먼저 떠올려 보세요.</p>
                </div>

                <div className="space-y-2">
                  {activeQuiz.options.map((option, index) => {
                    const isSelected = selectedOption === index
                    const isAnswer = activeQuiz.answer === index
                    const showCorrect = quizChecked && isAnswer
                    const showWrong = quizChecked && isSelected && !isAnswer
                    return (
                      <button key={option} type="button" disabled={quizChecked} onClick={() => setSelectedOption(index)} className={cn("flex min-h-12 w-full items-center gap-3 rounded-[1.1rem] border px-3.5 py-3 text-left text-sm font-semibold transition-[background-color,border-color,color,transform] active:scale-[0.96] disabled:cursor-default disabled:active:scale-100", showCorrect ? "border-nature-green/40 bg-nature-green/10 text-nature-green" : showWrong ? "border-danger/40 bg-danger/10 text-danger" : isSelected ? "border-sky-blue/45 bg-sky-blue/10 text-sky-blue" : "border-card-border/70 bg-background/70 text-foreground hover:border-sky-blue/30 hover:bg-sky-blue/5") }>
                        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-black", showCorrect ? "border-nature-green/40 bg-nature-green/15" : showWrong ? "border-danger/40 bg-danger/15" : isSelected ? "border-sky-blue/40 bg-sky-blue/15" : "border-card-border/70 text-muted-foreground")}>{showCorrect ? <Check className="size-3.5" /> : showWrong ? <X className="size-3.5" /> : index + 1}</span>
                        <span>{option}</span>
                      </button>
                    )
                  })}
                </div>

                {quizChecked ? (
                  <div className={cn("rounded-[1.2rem] border p-3.5 text-sm leading-6", selectedOption === activeQuiz.answer ? "border-nature-green/25 bg-nature-green/8 text-foreground" : "border-warning/25 bg-warning/8 text-foreground")}>
                    <p className="font-black">{selectedOption === activeQuiz.answer ? "정답이에요." : "한 번 더 연결해 볼까요?"}</p>
                    <p className="mt-1 text-muted-foreground">{activeQuiz.explanation}</p>
                    <p className="mt-2 border-t border-card-border/70 pt-2 text-xs font-bold text-muted-foreground">이제 {selectedModule.title}의 완료 기준을 다시 말해 보고, 학습 패턴의 다음 칸으로 넘어가 보세요.</p>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {quizChecked ? (
                    <>
                      <button type="button" onClick={() => { setSelectedOption(null); setQuizChecked(false) }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1rem] border border-card-border/70 bg-background/70 px-4 py-2.5 text-sm font-black text-foreground transition-[background-color,border-color,transform] hover:border-sky-blue/30 hover:bg-sky-blue/5 active:scale-[0.96]"><RotateCcw className="size-4" /> 다시 풀기</button>
                      <button type="button" onClick={moveToNextQuiz} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1rem] border border-active-blue/30 bg-active-blue px-4 py-2.5 text-sm font-black text-active-blue-foreground transition-[background-color,opacity,transform] hover:bg-active-blue/90 active:scale-[0.96]">다음 점검 <ArrowRight className="size-4" /></button>
                    </>
                  ) : (
                    <button type="button" disabled={selectedOption == null} onClick={checkQuiz} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1rem] border border-active-blue/30 bg-active-blue px-4 py-2.5 text-sm font-black text-active-blue-foreground transition-[background-color,opacity,transform] hover:bg-active-blue/90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 sm:col-span-2"><Check className="size-4" /> 답 확인하기</button>
                  )}
                </div>
              </div>
            </div>
          </MagicCard>
        </section>

        <SectionCard panelClassName="overflow-hidden">
          <div className="relative space-y-5">
            <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-nature-green/10 blur-3xl" />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-nature-green/25 bg-nature-green/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-nature-green"><Bot className="size-3.5" /> ai study coach</span>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">막힌 순간, 지금 단원과 함께 대화를 시작하세요.</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">단원·완료 기준·핵심 용어·최근 퀴즈 결과를 채팅 입력창에만 준비합니다. 아래 동작은 AI를 자동 호출하지 않으며, 채팅에서 직접 보내기를 눌렀을 때만 기존 일일 한도 안에서 요청됩니다.</p>
              </div>
              <span className="inline-flex items-center gap-2 self-start rounded-[1rem] border border-card-border/70 bg-background/70 px-3 py-2 text-xs font-bold text-muted-foreground lg:self-auto"><CheckCircle2 className="size-4 text-nature-green" /> 자동 호출 없음</span>
            </div>

            <div className="relative grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {STUDY_COACH_ACTIONS.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => openStudyCoach(action.request)}
                  className="group flex min-h-32 flex-col items-start rounded-[1.35rem] border border-card-border/70 bg-background/65 p-4 text-left shadow-[0_8px_24px_rgba(17,32,39,0.04)] transition-[background-color,border-color,color,transform,box-shadow] hover:-translate-y-0.5 hover:border-nature-green/35 hover:bg-nature-green/7 hover:shadow-[0_12px_28px_rgba(11,125,113,0.1)] active:scale-[0.96]"
                >
                  <span className="flex size-8 items-center justify-center rounded-[0.85rem] bg-nature-green/10 text-nature-green transition-[background-color,color,transform] group-hover:bg-nature-green group-hover:text-accent-foreground"><Bot className="size-4" /></span>
                  <span className="mt-3 text-sm font-black text-foreground">{action.title}</span>
                  <span className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{action.description}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-black text-nature-green">AI 채팅 준비 <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" /></span>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard panelClassName="overflow-hidden">
          <div className="relative space-y-5">
            <div className="pointer-events-none absolute -right-10 bottom-0 size-44 rounded-full bg-warning/10 blur-3xl" />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-warning/25 bg-warning/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-warning"><GraduationCap className="size-3.5" /> exam practice hub</span>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">정보처리기사 학습을 파트별로 바로 이어가세요.</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">필기 5과목과 실기 정보처리 실무의 큰 틀을 기준으로, 원하는 주제를 열어 바로 학습하거나 AI에게 한 문제씩 연습을 요청할 수 있어요.</p>
              </div>
              <a href="https://www.q-net.or.kr/crf005.do?gId=&gSite=Q&id=crf00503s02&jmCd=1320" target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-[1rem] border border-warning/30 bg-warning/9 px-4 py-2.5 text-sm font-black text-warning transition-[background-color,border-color,transform] hover:border-warning/50 hover:bg-warning/14 active:scale-[0.96] lg:self-auto">Q-Net 공식 종목 안내 <ArrowRight className="size-4" /></a>
            </div>
            <p className="relative rounded-[1.1rem] border border-card-border/70 bg-background/65 px-3.5 py-3 text-xs font-semibold leading-5 text-muted-foreground">접수 일정·응시자격·출제기준·공개문제는 바뀔 수 있으니 시험 신청 전에는 반드시 공식 안내를 다시 확인하세요.</p>
            <div className="relative grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {EXAM_TRACKS.map((track) => (
                <button key={track.title} type="button" onClick={() => startExamTrack(track)} className="group flex min-h-36 flex-col items-start rounded-[1.35rem] border border-card-border/70 bg-background/65 p-4 text-left shadow-[0_8px_24px_rgba(17,32,39,0.04)] transition-[background-color,border-color,color,transform,box-shadow] hover:-translate-y-0.5 hover:border-warning/35 hover:bg-warning/7 hover:shadow-[0_12px_28px_rgba(164,102,0,0.09)] active:scale-[0.96]">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-warning">{track.subtitle}</span>
                  <span className="mt-2 text-base font-black text-foreground">{track.title}</span>
                  <span className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{track.description}</span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-black text-warning">{track.phase ? "학습 경로 열기" : "AI 연습 준비"} <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" /></span>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">학습 지도</p>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">순서를 지키되, 막힌 지점은 다시 펼쳐 보세요.</h2>
              </div>
              <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                <button type="button" onClick={() => setSelectedPhase("all")} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1rem] border border-card-border/70 bg-background/70 px-3.5 py-2 text-sm font-bold text-muted-foreground transition-[background-color,border-color,color,transform] hover:border-sky-blue/30 hover:bg-sky-blue/7 hover:text-sky-blue active:scale-[0.96]"><Route className="size-4" /> 전체 보기</button>
                <button type="button" onClick={resetProgress} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[1rem] border border-card-border/70 bg-background/70 px-3.5 py-2 text-sm font-bold text-muted-foreground transition-[background-color,border-color,color,transform] hover:border-danger/30 hover:bg-danger/7 hover:text-danger active:scale-[0.96]"><RotateCcw className="size-4" /> 진도 초기화</button>
              </div>
            </div>

            <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 custom-scrollbar xl:mx-0 xl:grid xl:grid-cols-4 xl:overflow-visible xl:px-0 xl:pb-0">
              {PHASES.map((phase) => {
                const phaseModules = STUDY_MODULES.filter((module) => module.phase === phase.id)
                const phaseDone = phaseModules.filter((module) => completedSet.has(module.id)).length
                const isActive = selectedPhase === phase.id
                const nextPhaseModule = phaseModules.find((module) => !completedSet.has(module.id)) ?? phaseModules[0]
                return <button key={phase.id} type="button" onClick={() => { setSelectedPhase(phase.id); focusModule(nextPhaseModule.id) }} className={cn("min-h-32 min-w-[15.5rem] snap-start rounded-[1.45rem] border p-4 text-left transition-[background-color,border-color,transform] hover:-translate-y-0.5 active:scale-[0.96] xl:min-w-0", isActive ? phase.tone : "border-card-border/70 bg-background/65 hover:border-sky-blue/30 hover:bg-sky-blue/5")}>
                  <div className="flex items-start justify-between gap-3"><span className="text-xs font-black tracking-[0.18em] text-muted-foreground">{phase.order}</span><span className="rounded-full bg-card/80 px-2 py-1 text-xs font-black text-foreground tabular-nums">{phaseDone}/{phaseModules.length}</span></div>
                  <p className="mt-3 text-base font-black text-foreground">{phase.title}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{phase.subtitle}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground xl:line-clamp-2">{phase.description}</p>
                </button>
              })}
            </div>

            <div className="space-y-3">
              {visibleModules.map((module) => {
                const isCompleted = completedSet.has(module.id)
                const isSelected = selectedModule.id === module.id
                return (
                  <div key={module.id} className={cn("group rounded-[1.45rem] border p-4 transition-[background-color,border-color,box-shadow] sm:p-5", isSelected ? "border-sky-blue/35 bg-sky-blue/7 shadow-[0_10px_28px_rgba(47,111,228,0.08)]" : "border-card-border/70 bg-background/60 hover:border-sky-blue/25 hover:bg-sky-blue/4")}>
                    <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <button type="button" onClick={() => focusModule(module.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border", isCompleted ? "border-nature-green/35 bg-nature-green/10 text-nature-green" : "border-card-border/70 bg-card text-muted-foreground")}>
                          {isCompleted ? <Check className="size-4" /> : <Circle className="size-3.5" />}
                        </span>
                        <span className="min-w-0 space-y-1">
                          <span className="block text-xs font-black text-sky-blue">{module.chapter}</span>
                          <span className="block text-base font-black text-foreground">{module.title}</span>
                          <span className="block text-sm leading-6 text-muted-foreground line-clamp-2 sm:line-clamp-none">{module.summary}</span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-card-border/50 pt-3 sm:self-end sm:border-0 sm:pt-0 lg:self-auto">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Clock3 className="size-3.5" /> {module.minutes}분</span>
                        <button type="button" onClick={() => toggleModuleCompletion(module.id)} aria-label={`${module.title} ${isCompleted ? "완료 취소" : "완료"}`} className={cn("inline-flex min-h-10 min-w-10 items-center justify-center rounded-[0.9rem] border transition-[background-color,border-color,color,transform] active:scale-[0.96]", isCompleted ? "border-nature-green/25 bg-nature-green/10 text-nature-green hover:bg-nature-green/15" : "border-card-border/70 bg-card text-muted-foreground hover:border-nature-green/30 hover:bg-nature-green/8 hover:text-nature-green")}>
                          {isCompleted ? <Check className="size-4" /> : <ListChecks className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard panelClassName="bg-card/80">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[1rem] bg-sky-blue/10 text-sky-blue"><BookMarked className="size-5" /></span>
              <div className="space-y-1"><h2 className="text-lg font-black text-foreground">한 단원을 끝내는 4일 리듬</h2><p className="max-w-3xl text-sm leading-6 text-muted-foreground">읽기 → 손으로 추적 → 빈 화면 구현 → 한 문장 설명. 개념서를 결과 암기가 아니라 상태 변화와 선택 기준으로 복습하세요.</p></div>
            </div>
            <Link href="/lab" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[1rem] border border-sky-blue/25 bg-sky-blue/8 px-4 py-2.5 text-sm font-black text-sky-blue transition-[background-color,border-color,transform] hover:border-sky-blue/45 hover:bg-sky-blue/14 active:scale-[0.96]">실험실로 돌아가기 <ArrowRight className="size-4" /></Link>
          </div>
        </SectionCard>
      </div>
    </main>
  )
}
