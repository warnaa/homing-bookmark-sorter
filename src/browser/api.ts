import type { BookmarkSnapshot, FolderSnapshot } from "../domain/types.js";

export interface BrowserGateway {
  getBookmark(id: string): Promise<BookmarkSnapshot | undefined>;
  getFolder(id: string): Promise<FolderSnapshot | undefined>;
  getChildren(id: string): Promise<BookmarkSnapshot[]>;
  moveBookmark(id: string, parentId: string): Promise<BookmarkSnapshot>;
  markFolderModified(folderId: string): Promise<void>;
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

  /**
   * Makes the folder the browser's most recently modified one, which the
   * bookmark dialog offers by default. Only a move into a folder updates its
   * modification time, so a temporary folder is created inside a temporary
   * holder, moved up into the folder, and both are removed again.
   */
  async markFolderModified(folderId: string): Promise<void> {
    const title =
      chrome.i18n.getMessage("temporaryFolderTitle") || "Homing (temporary)";
    const holder = await chrome.bookmarks.create({ parentId: folderId, title });
    let marker: chrome.bookmarks.BookmarkTreeNode | undefined;
    try {
      marker = await chrome.bookmarks.create({ parentId: holder.id, title });
      await chrome.bookmarks.move(marker.id, { parentId: folderId });
    } finally {
      if (marker) await chrome.bookmarks.removeTree(marker.id).catch(() => undefined);
      await chrome.bookmarks.removeTree(holder.id);
    }
  }

  async setBadge(text: string): Promise<void> {
    await chrome.action.setBadgeBackgroundColor({ color: "#9b5d18" });
    await chrome.action.setBadgeText({ text });
  }
}

export { toBookmarkSnapshot };
