import { describe, expect, it } from "vitest";
import { domainFromUrl, inferMatchType } from "./rule-input.js";

describe("inferMatchType", () => {
  it("keeps the current selection for blank input", () => {
    expect(inferMatchType("   ")).toBeUndefined();
  });

  it("treats bare domains as domain-and-subdomain rules", () => {
    expect(inferMatchType("github.com")).toBe("domain_suffix");
    expect(inferMatchType(" docs.example.co.uk ")).toBe("domain_suffix");
    expect(inferMatchType("żółw.pl")).toBe("domain_suffix");
  });

  it("treats wildcards and paths as URL patterns", () => {
    expect(inferMatchType("https://example.com/docs/*")).toBe("url_pattern");
    expect(inferMatchType("example.com/blog")).toBe("url_pattern");
    expect(inferMatchType("*.example.com")).toBe("url_pattern");
  });

  it("treats words and phrases as title keywords", () => {
    expect(inferMatchType("recipe")).toBe("title_keyword");
    expect(inferMatchType("release notes")).toBe("title_keyword");
  });
});

describe("domainFromUrl", () => {
  it("extracts the hostname without www", () => {
    expect(domainFromUrl("https://www.GitHub.com/user/repo?tab=1")).toBe(
      "github.com",
    );
    expect(domainFromUrl("http://docs.example.com.")).toBe("docs.example.com");
  });

  it("ignores non-URLs and wildcard patterns", () => {
    expect(domainFromUrl("github.com")).toBeUndefined();
    expect(domainFromUrl("https://example.com/*")).toBeUndefined();
    expect(domainFromUrl("chrome://settings")).toBeUndefined();
    expect(domainFromUrl("https://")).toBeUndefined();
  });
});
