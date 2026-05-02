export type Grade = 1 | 2 | 3;

/**
 * 학교명에서 학년(고1/고2/고3) 추출.
 * "시온고1", "소사고 3", "고2반" 등에서 숫자 추출. 실패 시 폴백 = 고2.
 */
export function extractGradeFromSchoolName(name?: string | null): Grade {
  if (!name) return 2;
  const m = name.match(/고\s*([1-3])/);
  return (m ? Number(m[1]) : 2) as Grade;
}