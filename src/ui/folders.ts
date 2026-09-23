import { toFolderSnapshot } from "../browser/api.js";
import type { FolderSnapshot } from "../domain/types.js";

export interface FolderChoice extends FolderSnapshot {
  path: string;
}

export function flattenFolders(
  roots: chrome.bookmarks.BookmarkTreeNode[],
): FolderChoice[] {
  const folders: FolderChoice[] = [];

  const visit = (node: chrome.bookmarks.BookmarkTreeNode, parents: string[]) => {
    if (node.url) return;
    const parts = node.title ? [...parents, node.title] : parents;
    if (node.parentId) {
      folders.push({ ...toFolderSnapshot(node), path: parts.join(" / ") });
    }
    for (const child of node.children ?? []) visit(child, parts);
  };

  for (const root of roots) visit(root, []);
  return folders;
}

export async function loadFolderChoices(): Promise<FolderChoice[]> {
  return flattenFolders(await chrome.bookmarks.getTree());
}

export function folderMap(
  folders: FolderChoice[],
): Map<string, FolderSnapshot> {
  return new Map(folders.map((folder) => [folder.id, folder]));
}
