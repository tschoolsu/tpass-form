import { describe, it, expect } from "vitest";
import {
  MAX_FILE_MB,
  fileLimits,
  describeAccept,
  guessMime,
  mimeAllowed,
  describeUploadError,
} from "./file-limits";

describe("fileLimits", () => {
  it("沒設定時給預設值", () => {
    expect(fileLimits({})).toEqual({ maxFiles: 1, maxSizeMB: 10, accept: [] });
  });

  it("單檔上限被 clamp 到主機吃得下的值，舊資料寫 100 也不會壞", () => {
    expect(fileLimits({ file: { accept: [], maxSizeMB: 100, maxFiles: 10 } }).maxSizeMB).toBe(
      MAX_FILE_MB,
    );
    expect(fileLimits({ file: { accept: [], maxSizeMB: 5, maxFiles: 1 } }).maxSizeMB).toBe(5);
  });
});

describe("describeAccept", () => {
  it("常見類型翻成中文，副檔名去點大寫，其餘原文", () => {
    expect(describeAccept(["image/*", ".pdf"])).toBe("圖片、PDF");
    expect(describeAccept([".docx"])).toBe("DOCX");
    expect(describeAccept(["application/vnd.ms-excel"])).toBe("application/vnd.ms-excel");
    expect(describeAccept([])).toBe("");
  });
});

describe("guessMime", () => {
  it("瀏覽器有給就用它的", () => {
    expect(guessMime("a.bin", "image/png")).toBe("image/png");
  });
  it("沒給就靠副檔名，認不得回 octet-stream", () => {
    expect(guessMime("IMG_0001.JPG", "")).toBe("image/jpeg");
    expect(guessMime("photo.heic", "")).toBe("image/heic");
    expect(guessMime("weird.xyz", "")).toBe("application/octet-stream");
    expect(guessMime("noext", "")).toBe("application/octet-stream");
  });
});

describe("mimeAllowed", () => {
  it("空清單不限制", () => {
    expect(mimeAllowed([], "application/octet-stream", "x.bin")).toBe(true);
  });
  it("三種規則：副檔名 / 萬用 / 精確", () => {
    expect(mimeAllowed([".pdf"], "application/octet-stream", "報告.PDF")).toBe(true);
    expect(mimeAllowed(["image/*"], "image/webp", "a.webp")).toBe(true);
    expect(mimeAllowed(["application/pdf"], "application/pdf", "a")).toBe(true);
    expect(mimeAllowed(["image/*"], "application/pdf", "a.pdf")).toBe(false);
  });
  it("Android 不給 type 的照片，靠 guessMime 補上後能過 image/*", () => {
    expect(mimeAllowed(["image/*"], guessMime("IMG_1.jpg", ""), "IMG_1.jpg")).toBe(true);
  });
});

describe("describeUploadError", () => {
  it("已知狀態碼講該做什麼，未知的才說再試一次", () => {
    expect(describeUploadError(413)).toBe("檔案太大");
    expect(describeUploadError(401)).toMatch(/重新整理/);
    expect(describeUploadError(500)).toMatch(/HTTP 500.*再試一次/);
  });
});
