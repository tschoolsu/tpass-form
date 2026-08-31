import { describe, it, expect } from "vitest";
import { collectUploadIds, removedUploadIds } from "./upload-refs";

const f = (id: string) => ({ id, name: `${id}.pdf` });

describe("collectUploadIds", () => {
  it("只撿檔案題（UploadedFile[]）的 id，其餘題型略過", () => {
    expect(collectUploadIds({ q1: [f("a"), f("b")], q2: "文字", q3: ["opt1"], q4: null })).toEqual([
      "a",
      "b",
    ]);
    expect(collectUploadIds(undefined)).toEqual([]);
  });
});

describe("removedUploadIds", () => {
  it("回傳舊答案有、新答案沒有的 upload id", () => {
    expect(removedUploadIds({ q1: [f("a"), f("b")] }, { q1: [f("b")] })).toEqual(["a"]);
  });
  it("新增或不變都不算移除", () => {
    expect(removedUploadIds({ q1: [f("a")] }, { q1: [f("a"), f("c")] })).toEqual([]);
  });
  it("整題被刪掉 → 該題所有附件都算移除", () => {
    expect(removedUploadIds({ q1: [f("a")], q2: [f("x")] }, { q1: [f("a")] })).toEqual(["x"]);
  });
});
