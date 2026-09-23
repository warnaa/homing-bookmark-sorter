import type { BookmarkSnapshot, FolderSnapshot } from "../domain/types.js";

export interface BrowserGateway {
  getBookmark(id: string): Promise<BookmarkSnapshot | undefined>;
  getFolder(id: string): Promise<FolderSnapshot | undefined>;
  getChildren(id: string): Promise<BookmarkSnapshot[]>;
  moveBookmark(id: string, parentId: string): Promise<BookmarkSnapshot>;
  setBadge(text: string): Promise<void>;
}

function toBookmarkSnapshot(
  node: chrome.bookmarks.BookmarkTreeNode,
): BookmarkSnapshot {
  return {
    id: node.id,
    parentId: node.parentId,
    title: node.title,
    url: node.url,
    unmodifiable: node.unmodifiable,
  };
}

export function toFolderSnapshot(
  node: chrome.bookmarks.BookmarkTreeNode,
): FolderSnapshot {
  return {
    id: node.id,
    parentId: node.parentId,
    title: node.title,
    unmodifiable: node.unmodifiable,
  };
}

export class ChromeBrowserGateway implements BrowserGateway {
  async getBookmark(id: string): Promise<BookmarkSnapshot | undefined> {
    try {
      const nodes = await chrome.bookmarks.get(id);
      const node = nodes[0];
      return node ? toBookmarkSnapshot(node) : undefined;
    } catch {
      return undefined;
    }
  }

  async getFolder(id: string): Promise<FolderSnapshot | undefined> {
    const node = await this.getBookmark(id);
    if (!node || node.url) return undefined;
    return {
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      unmodifiable: node.unmodifiable,
    };
  }

  async getChildren(id: string): Promise<BookmarkSnapshot[]> {
    const nodes = await chrome.bookmarks.getChildren(id);
    return nodes.map(toBookmarkSnapshot);
  }

  async moveBookmark(id: string, parentId: string): Promise<BookmarkSnapshot> {
    const node = await chrome.bookmarks.move(id, { parentId });
    return toBookmarkSnapshot(node);
  }

  async setBadge(text: string): Promise<void> {
    await chrome.action.setBadgeBackgroundColor({ color: "#9b5d18" });
    await chrome.action.setBadgeText({ text });
  }
}

export { toBookmarkSnapshot };
