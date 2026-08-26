import { describe, it, expect } from "vitest";
import { collectAssetIds, pickOrphans, ORPHAN_GRACE_MS, type AssetRow } from "./asset-refs";
import {
  formDefinitionSchema,
  formSettingsSchema,
  type FormDefinition,
  type FormSettings,
} from "./survey-schema";

const def = (blocks: unknown[]): FormDefinition => formDefinitionSchema.parse({ blocks });
const settings = (patch: Record<string, unknown> = {}): FormSettings =>
  formSettingsSchema.parse(patch);

describe("collectAssetIds", () => {
  it("四處說明欄的圖都要收到", () => {
    const ids = collectAssetIds(
      def([
        { kind: "question", id: "q1", type: "short_text", title: "題", images: [{ id: "a_q" }] },
        { kind: "section", id: "s1", images: [{ id: "a_s" }] },
        { kind: "text", id: "t1", images: [{ id: "a_t" }] },
      ]),
      settings({ images: [{ id: "a_form" }] }),
    );
    expect([...ids].sort()).toEqual(["a_form", "a_q", "a_s", "a_t"]);
  });

  it("同一張圖被多處引用只算一次", () => {
    const ids = collectAssetIds(
      def([
        { kind: "text", id: "t1", images: [{ id: "dup" }] },
        { kind: "text", id: "t2", images: [{ id: "dup" }] },
      ]),
      settings(),
    );
    expect([...ids]).toEqual(["dup"]);
  });

  it("舊資料沒有 images 欄也不炸", () => {
    const ids = collectAssetIds(
      def([{ kind: "text", id: "t1", heading: "舊的" }]),
      settings(),
    );
    expect(ids.size).toBe(0);
  });
});

describe("pickOrphans", () => {
  const now = new Date("2026-08-26T12:00:00Z");
  const ago = (ms: number): Date => new Date(now.getTime() - ms);
  const row = (id: string, createdAt: Date): AssetRow => ({
    id,
    storageKey: `key_${id}`,
    createdAt,
  });

  it("沒被引用又過了緩衝期 → 刪", () => {
    const orphans = pickOrphans([row("old", ago(ORPHAN_GRACE_MS * 2))], new Set(), now);
    expect(orphans.map((o) => o.id)).toEqual(["old"]);
  });

  it("被引用的絕不刪，即使很舊", () => {
    const orphans = pickOrphans(
      [row("used", ago(ORPHAN_GRACE_MS * 100))],
      new Set(["used"]),
      now,
    );
    expect(orphans).toEqual([]);
  });

  it("剛上傳還沒存檔的不刪（緩衝期內）", () => {
    const orphans = pickOrphans([row("fresh", ago(60_000))], new Set(), now);
    expect(orphans).toEqual([]);
  });

  it("緩衝期邊界：正好 grace 不刪，超過才刪", () => {
    expect(pickOrphans([row("edge", ago(ORPHAN_GRACE_MS))], new Set(), now)).toEqual([]);
    expect(
      pickOrphans([row("edge", ago(ORPHAN_GRACE_MS + 1))], new Set(), now).map((o) => o.id),
    ).toEqual(["edge"]);
  });
});
