import { describe, expect, it } from "vitest";
import { getSidebarVisibleProjects } from "../app/components/sidebar/projects/sidebar-projects.helpers";
import type { Project } from "../app/types";

const projects: Project[] = [
  {
    id: "/alpha",
    name: "Alpha",
    pinned: false,
    repoOriginUrl: null,
    repoOriginChecked: true,
    collapsed: false,
    threadsLoaded: true,
    threadCount: 2,
    threads: [
      { id: "a1", title: "First thread", age: "1m", pinned: false, sessionPath: "/alpha/1" },
      { id: "a2", title: "Favourite task", age: "2m", pinned: true, sessionPath: "/alpha/2" },
    ],
  },
  {
    id: "/beta",
    name: "Beta",
    pinned: true,
    repoOriginUrl: "https://github.com/example/beta.git",
    repoOriginChecked: true,
    collapsed: false,
    threadsLoaded: true,
    threadCount: 1,
    threads: [{ id: "b1", title: "Build", age: "3m", pinned: false, sessionPath: "/beta/1" }],
  },
];

describe("sidebar projects helpers", () => {
  it("filters by search query across project and thread names", () => {
    const result = getSidebarVisibleProjects({
      projects,
      searchQuery: "favourite",
      filterMode: "all",
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.id).toBe("/alpha");
    expect(result.projects[0]?.threads).toHaveLength(1);
    expect(result.projects[0]?.threads[0]?.id).toBe("a2");
    expect(result.autoExpandedProjectIds.has("/alpha")).toBe(true);
  });

  it("filters favourites using project and thread favourite state", () => {
    const result = getSidebarVisibleProjects({
      projects,
      searchQuery: "",
      filterMode: "favourites",
    });

    expect(result.projects.map((project) => project.id)).toEqual(["/alpha", "/beta"]);
    expect(result.projects[0]?.threads.map((thread) => thread.id)).toEqual(["a2"]);
    expect(result.projects[1]?.threads.map((thread) => thread.id)).toEqual(["b1"]);
  });

  it("filters github projects only", () => {
    const result = getSidebarVisibleProjects({
      projects,
      searchQuery: "",
      filterMode: "github",
    });

    expect(result.projects.map((project) => project.id)).toEqual(["/beta"]);
  });
});
