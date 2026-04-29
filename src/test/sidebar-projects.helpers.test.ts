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
      {
        id: "a1",
        title: "First thread",
        age: "1m",
        pinned: false,
        sessionPath: "/alpha/1",
        lastModifiedMs: 100,
      },
      {
        id: "a2",
        title: "Favourite task",
        age: "2m",
        pinned: true,
        sessionPath: "/alpha/2",
        lastModifiedMs: 250,
      },
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
    threads: [
      {
        id: "b1",
        title: "Build",
        age: "3m",
        pinned: false,
        sessionPath: "/beta/1",
        lastModifiedMs: 350,
      },
    ],
  },
];

const emptyRunningSessionPaths = new Set<string>();
const emptyRunningProjectIds = new Set<string>();

describe("sidebar projects helpers", () => {
  it("filters by search query across project and thread names", () => {
    const result = getSidebarVisibleProjects({
      projects,
      searchQuery: "favourite",
      filterMode: "all",
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 0,
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.id).toBe("/alpha");
    expect(result.projects[0]?.threads.map((thread) => thread.id)).toEqual(["a2"]);
    expect(result.autoExpandedProjectIds.has("/alpha")).toBe(true);
  });

  it("supports the main filter modes", () => {
    expect(
      getSidebarVisibleProjects({
        projects,
        searchQuery: "",
        filterMode: "favourites",
        terminalRunningProjectIds: emptyRunningProjectIds,
        terminalRunningSessionPaths: emptyRunningSessionPaths,
        appLaunchedAtMs: 0,
      }).projects.map((project) => project.id),
    ).toEqual(["/alpha", "/beta"]);

    expect(
      getSidebarVisibleProjects({
        projects,
        searchQuery: "",
        filterMode: "github",
        terminalRunningProjectIds: emptyRunningProjectIds,
        terminalRunningSessionPaths: emptyRunningSessionPaths,
        appLaunchedAtMs: 0,
      }).projects.map((project) => project.id),
    ).toEqual(["/beta"]);

    const terminalResult = getSidebarVisibleProjects({
      projects,
      searchQuery: "",
      filterMode: "terminal",
      terminalRunningProjectIds: new Set(["/alpha"]),
      terminalRunningSessionPaths: new Set(["/alpha/2"]),
      appLaunchedAtMs: 0,
    });
    expect(terminalResult.projects.map((project) => project.id)).toEqual(["/alpha"]);
    expect(terminalResult.projects[0]?.threads.map((thread) => thread.id)).toEqual(["a2"]);

    const recentResult = getSidebarVisibleProjects({
      projects,
      searchQuery: "",
      filterMode: "recent",
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 300,
    });
    expect(recentResult.projects.map((project) => project.id)).toEqual(["/beta"]);
    expect(recentResult.projects[0]?.threads.map((thread) => thread.id)).toEqual(["b1"]);
  });

  it("keeps lazy projects visible for terminal and recent filters while threads load", () => {
    const lazyProjects: Project[] = [
      {
        id: "/lazy-terminal",
        name: "Lazy terminal",
        threads: [],
        threadsLoaded: false,
        threadCount: 1,
      },
      {
        id: "/lazy-recent",
        name: "Lazy recent",
        threads: [],
        threadsLoaded: false,
        threadCount: 1,
        latestModifiedMs: 999,
      },
    ];

    expect(
      getSidebarVisibleProjects({
        projects: lazyProjects,
        searchQuery: "",
        filterMode: "terminal",
        terminalRunningProjectIds: new Set(["/lazy-terminal"]),
        terminalRunningSessionPaths: emptyRunningSessionPaths,
        appLaunchedAtMs: 0,
      }).projects.map((project) => project.id),
    ).toEqual(["/lazy-terminal"]);

    expect(
      getSidebarVisibleProjects({
        projects: lazyProjects,
        searchQuery: "",
        filterMode: "recent",
        terminalRunningProjectIds: emptyRunningProjectIds,
        terminalRunningSessionPaths: emptyRunningSessionPaths,
        appLaunchedAtMs: 500,
      }).projects.map((project) => project.id),
    ).toEqual(["/lazy-recent"]);
  });

  it("preserves indexed thread counts for unloaded projects before search", () => {
    const result = getSidebarVisibleProjects({
      projects: [
        {
          id: "/howcode",
          name: "howcode",
          threads: [],
          threadsLoaded: false,
          threadCount: 74,
        },
      ],
      searchQuery: "",
      filterMode: "all",
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 0,
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.threadCount).toBe(74);
    expect(result.projects[0]?.threadsLoaded).toBe(false);
  });

  it("preserves indexed thread counts when search matches an unloaded project name", () => {
    const result = getSidebarVisibleProjects({
      projects: [
        {
          id: "/howcode",
          name: "howcode",
          threads: [],
          threadsLoaded: false,
          threadCount: 74,
        },
      ],
      searchQuery: "howc",
      filterMode: "all",
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 0,
    });

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.threadCount).toBe(74);
    expect(result.projects[0]?.threadsLoaded).toBe(false);
    expect(result.autoExpandedProjectIds.has("/howcode")).toBe(true);
  });

  it("keeps newly created projects visible at the top regardless of filter or search", () => {
    const result = getSidebarVisibleProjects({
      projects,
      searchQuery: "missing",
      filterMode: "favourites",
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 0,
      priorityProjectIds: ["/beta", "/alpha"],
    });

    expect(result.projects.map((project) => project.id)).toEqual(["/beta", "/alpha"]);
  });
});
