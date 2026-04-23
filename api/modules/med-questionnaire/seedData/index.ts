/**
 * 医療問診票シードデータ統合エクスポート
 * 発熱患者問診台本に基づく構造化データ
 */

import { logger } from '@api/lib/logger';
import { type AnswerPatternSeed, answerPatternSeeds } from './answerPatterns';
import { type QuestionTemplateSeed, questionTemplateSeeds } from './questionTemplates';

// 型定義の再エクスポート
export type { AnswerPatternSeed, QuestionTemplateSeed };

// シードデータの統合エクスポート
export { answerPatternSeeds, questionTemplateSeeds };

/**
 * 問診段階（ステージ）の定義
 */
export const questionnaireStages = [
  'basic_info', // 基本情報収集
  'visit_info', // 来院方法・PCR検査希望
  'vitals', // 体温・バイタルサイン
  'symptoms', // 症状確認
  'vaccination', // ワクチン接種歴
  'contact_history', // 接触歴・渡航歴
  'medical_history', // 既往歴・治療歴
  'medication_allergy', // 服薬・アレルギー歴
  'lifestyle', // 生活習慣
  'completion', // 問診完了
] as const;

export type QuestionnaireStage = (typeof questionnaireStages)[number];

/**
 * ステージ別質問マッピング
 */
export const stageQuestionMapping: Record<QuestionnaireStage, string[]> = {
  basic_info: [
    'patient_name',
    'gender',
    'birth_date',
    'address',
    'phone_number',
    'emergency_contact',
  ],
  visit_info: ['transport_method', 'pcr_test_desired'],
  vitals: ['height', 'weight', 'morning_temperature', 'current_temperature', 'fever_start_date'],
  symptoms: ['current_symptoms', 'other_symptoms'],
  vaccination: ['vaccination_count', 'vaccination_1st', 'vaccination_2nd', 'vaccination_latest'],
  contact_history: ['suspected_contact', 'close_contact', 'overseas_travel', 'travel_contact'],
  medical_history: [
    'other_hospital_visit',
    'chronic_treatment',
    'treatment_details',
    'hospital_history',
    'surgery_history',
  ],
  medication_allergy: ['otc_medication', 'medication_details', 'drug_allergies', 'allergy_details'],
  lifestyle: ['drinking_habits', 'drinking_frequency', 'smoking_habits', 'smoking_history'],
  completion: [],
};

/**
 * 質問の依存関係定義
 */
export const questionDependencies: Record<
  string,
  {
    dependsOn: string;
    condition: 'equals' | 'notEquals' | 'greaterThan' | 'in';
    value: any;
  }
> = {
  // ワクチン接種歴の依存関係
  vaccination_1st: {
    dependsOn: 'vaccination_count',
    condition: 'greaterThan',
    value: 0,
  },
  vaccination_2nd: {
    dependsOn: 'vaccination_count',
    condition: 'greaterThan',
    value: 1,
  },
  vaccination_latest: {
    dependsOn: 'vaccination_count',
    condition: 'greaterThan',
    value: 2,
  },

  // 治療詳細の依存関係
  treatment_details: {
    dependsOn: 'chronic_treatment',
    condition: 'equals',
    value: true,
  },

  // 服薬詳細の依存関係
  medication_details: {
    dependsOn: 'otc_medication',
    condition: 'equals',
    value: true,
  },

  // アレルギー詳細の依存関係
  allergy_details: {
    dependsOn: 'drug_allergies',
    condition: 'equals',
    value: true,
  },

  // 飲酒詳細の依存関係
  drinking_frequency: {
    dependsOn: 'drinking_habits',
    condition: 'notEquals',
    value: '飲まない',
  },

  // 喫煙歴詳細の依存関係
  smoking_history: {
    dependsOn: 'smoking_habits',
    condition: 'in',
    value: ['禁煙した', '以前は吸っていた'],
  },
};

/**
 * ステージの進行順序
 */
export const stageOrder: QuestionnaireStage[] = [
  'basic_info',
  'visit_info',
  'vitals',
  'symptoms',
  'vaccination',
  'contact_history',
  'medical_history',
  'medication_allergy',
  'lifestyle',
  'completion',
];

/**
 * ステージ表示名（日本語）
 */
export const stageDisplayNames: Record<QuestionnaireStage, string> = {
  basic_info: '基本情報',
  visit_info: '来院情報',
  vitals: 'バイタルサイン',
  symptoms: '症状確認',
  vaccination: 'ワクチン接種歴',
  contact_history: '接触・渡航歴',
  medical_history: '既往歴・治療歴',
  medication_allergy: '服薬・アレルギー歴',
  lifestyle: '生活習慣',
  completion: '問診完了',
};

/**
 * ユーティリティ関数
 */

/**
 * 指定ステージの質問テンプレートを取得
 */
export function getQuestionsByStage(stage: QuestionnaireStage): QuestionTemplateSeed[] {
  return questionTemplateSeeds.filter((q) => q.stage === stage);
}

/**
 * 質問キーに対応する回答パターンを取得
 */
export function getAnswerPatternsByQuestion(questionKey: string): AnswerPatternSeed[] {
  return answerPatternSeeds.filter((p) => p.questionKey === questionKey);
}

/**
 * 次のステージを取得
 */
export function getNextStage(currentStage: QuestionnaireStage): QuestionnaireStage | null {
  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
    return null;
  }
  return stageOrder[currentIndex + 1] || null;
}

/**
 * 前のステージを取得
 */
export function getPreviousStage(currentStage: QuestionnaireStage): QuestionnaireStage | null {
  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex <= 0) {
    return null;
  }
  return stageOrder[currentIndex - 1] || null;
}

/**
 * ステージの進行率を計算
 */
export function calculateProgress(currentStage: QuestionnaireStage): number {
  const currentIndex = stageOrder.indexOf(currentStage);
  if (currentIndex === -1) return 0;
  return Math.round((currentIndex / (stageOrder.length - 1)) * 100);
}

/**
 * 質問の依存関係をチェック
 */
export function checkQuestionDependency(
  questionKey: string,
  answers: Record<string, any>
): boolean {
  const dependency = questionDependencies[questionKey];
  if (!dependency) return true; // 依存関係なし

  const dependentValue = answers[dependency.dependsOn];

  switch (dependency.condition) {
    case 'equals':
      return dependentValue === dependency.value;
    case 'notEquals':
      return dependentValue !== dependency.value;
    case 'greaterThan':
      return Number(dependentValue) > dependency.value;
    case 'in':
      return Array.isArray(dependency.value) && dependency.value.includes(dependentValue);
    default:
      return true;
  }
}

/**
 * シードデータ統計情報
 */
export const seedDataStats = {
  totalQuestions: questionTemplateSeeds.length,
  totalAnswerPatterns: answerPatternSeeds.length,
  stageCount: questionnaireStages.length,
  questionsByStage: Object.fromEntries(
    questionnaireStages.map((stage) => [
      stage,
      questionTemplateSeeds.filter((q) => q.stage === stage).length,
    ])
  ),
  patternsByType: {
    standard: answerPatternSeeds.filter((p) => p.patternType === 'standard').length,
    variation: answerPatternSeeds.filter((p) => p.patternType === 'variation').length,
    edge_case: answerPatternSeeds.filter((p) => p.patternType === 'edge_case').length,
  },
};

logger.info({ stats: seedDataStats }, '医療問診票シードデータ統計');
