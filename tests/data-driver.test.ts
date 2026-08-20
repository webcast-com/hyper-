import { afterEach, describe, expect, it } from "vitest";
import { dataDriver, describeDataBackend, isJsonDriver, prismaProviderFromUrl } from "../lib/data-driver";

const originalDriver = process.env.DATA_DRIVER;
const originalUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDriver === undefined) delete process.env.DATA_DRIVER;
  else process.env.DATA_DRIVER = originalDriver;
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
});

describe("data driver", () => {
  it("treats DATA_DRIVER=json as the JSON file backend", () => {
    process.env.DATA_DRIVER = "json";
    expect(isJsonDriver()).toBe(true);
    expect(dataDriver()).toBe("json");
    expect(describeDataBackend()).toMatchObject({ driver: "json", store: "data/db.json", provider: "json" });
  });

  it("defaults to prisma and classifies DATABASE_URL without mixing sqlite and postgres", () => {
    process.env.DATA_DRIVER = "prisma";
    process.env.DATABASE_URL = "postgresql://creator:creator@localhost:5432/creator_connect";
    expect(isJsonDriver()).toBe(false);
    expect(describeDataBackend()).toMatchObject({ driver: "prisma", provider: "postgresql", store: "postgresql" });
    expect(prismaProviderFromUrl("file:./dev.db")).toBe("sqlite");
  });
});
