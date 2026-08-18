import { describe, expect, test } from "bun:test";
import { extractYouTubeVideos } from "./youtube.js";

describe("YouTube 채널 페이지 어댑터", () => {
  test("초기 페이지 데이터에서 공개 영상 정보를 수집한다", () => {
    const html = `<script>var ytInitialData = ${JSON.stringify({
      contents: [{
        richItemRenderer: {
          content: {
            videoRenderer: {
              videoId: "nfUKLULchXE",
              title: { runs: [{ text: "루프가 아니라 그래프를 설계하는 이유" }] },
              publishedTimeText: { simpleText: "2주 전" },
              descriptionSnippet: { runs: [{ text: "에이전트 실행 그래프를 설명한다." }] },
            },
          },
        },
      }],
    })};</script>`;

    expect(extractYouTubeVideos(html, 8)).toEqual([{
      title: "루프가 아니라 그래프를 설계하는 이유",
      url: "https://www.youtube.com/watch?v=nfUKLULchXE",
      published: "2주 전",
      excerpt: "에이전트 실행 그래프를 설명한다.",
      kind: "page-video",
    }]);
  });

  test("최신 lockup 형식의 영상 정보를 수집한다", () => {
    const html = `<script>var ytInitialData = ${JSON.stringify({
      contents: [{
        richItemRenderer: {
          content: {
            lockupViewModel: {
              contentId: "wQkFDtqwQCk",
              metadata: {
                lockupMetadataViewModel: {
                  title: { content: "AI 자동화에서 얻은 핵심 교훈" },
                  metadata: {
                    contentMetadataViewModel: {
                      metadataRows: [{
                        metadataParts: [
                          { text: { content: "조회수 32회" } },
                          { text: { content: "18분 전" } },
                        ],
                      }],
                    },
                  },
                },
              },
            },
          },
        },
      }],
    })};</script>`;

    expect(extractYouTubeVideos(html, 8)).toEqual([{
      title: "AI 자동화에서 얻은 핵심 교훈",
      url: "https://www.youtube.com/watch?v=wQkFDtqwQCk",
      published: "18분 전",
      kind: "page-video",
    }]);
  });
});
