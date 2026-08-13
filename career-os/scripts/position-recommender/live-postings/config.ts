import { positionCollectionConfig } from "../../../config/position-collection.ts";

export interface WantedCollectionConfig {
  jobGroupId: number;
}

/**
 * Wanted 탐색 범위만 반환한다.
 * 후보자 경력과 관심사는 수집 단계에 넣지 않고 추천 모델이 판단한다.
 */
export function loadWantedCollectionConfig(): WantedCollectionConfig {
  return positionCollectionConfig.wanted;
}
