import { describe, expect, it } from "vitest";
import { flattenFolders } from "./folders.js";

describe("flattenFolders", () => {
  it("records each folder's full path and parent path", () => {
    const folders = flattenFolders([
      {
        id: "0",
        title: "",
        syncing: false,
        children: [
          {
            id: "1",
            parentId: "0",
            title: "Bookmarks bar",
            syncing: false,
            children: [
              {
                id: "10",
                parentId: "1",
                title: "Dev",
                syncing: false,
                children: [
                  { id: "11", parentId: "10", title: "Docs", syncing: false, children: [] },
                  { id: "12", parentId: "10", title: "Link", url: "https://example.com", syncing: false },
                ],
              },
            ],
          },
        ],
      },
    ]);

    expect(
      folders.map(({ id, path, parentPath }) => ({ id, path, parentPath })),
    ).toEqual([
      { id: "1", path: "Bookmarks bar", parentPath: "" },
      { id: "10", path: "Bookmarks bar / Dev", parentPath: "Bookmarks bar" },
      { id: "11", path: "Bookmarks bar / Dev / Docs", parentPath: "Bookmarks bar / Dev" },
    ]);
  });
});
