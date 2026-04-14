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
    expect(result.projects[0]?.threads).toHaveLength(1);
    expect(result.projects[0]?.threads[0]?.id).toBe("a2");
    expect(result.autoExpandedProjectIds.has("/alpha")).toBe(true);
  });

  it("filters favourites using project and thread favourite state", () => {
    const result = getSidebarVisibleProjects({
      projects,
      searchQuery: "",
      filterMode: "favourites",
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 0,
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
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 0,
    });

    expect(result.projects.map((project) => project.id)).toEqual(["/beta"]);
  });

  it("filters threads with running terminals only", () => {
    const result = getSidebarVisibleProjects({
      projects,
      searchQuery: "",
      filterMode: "terminal",
      terminalRunningProjectIds: new Set(["/alpha"]),
      terminalRunningSessionPaths: new Set(["/alpha/2"]),
      appLaunchedAtMs: 0,
    });

    expect(result.projects.map((project) => project.id)).toEqual(["/alpha"]);
    expect(result.projects[0]?.threads.map((thread) => thread.id)).toEqual(["a2"]);
  });

  it("filters threads active since app launch", () => {
    const result = getSidebarVisibleProjects({
      projects,
      searchQuery: "",
      filterMode: "recent",
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 300,
    });

    expect(result.projects.map((project) => project.id)).toEqual(["/beta"]);
    expect(result.projects[0]?.threads.map((thread) => thread.id)).toEqual(["b1"]);
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

    const terminalResult = getSidebarVisibleProjects({
      projects: lazyProjects,
      searchQuery: "",
      filterMode: "terminal",
      terminalRunningProjectIds: new Set(["/lazy-terminal"]),
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 0,
    });
    const recentResult = getSidebarVisibleProjects({
      projects: lazyProjects,
      searchQuery: "",
      filterMode: "recent",
      terminalRunningProjectIds: emptyRunningProjectIds,
      terminalRunningSessionPaths: emptyRunningSessionPaths,
      appLaunchedAtMs: 500,
    });

    expect(terminalResult.projects.map((project) => project.id)).toEqual(["/lazy-terminal"]);
    expect(recentResult.projects.map((project) => project.id)).toEqual(["/lazy-recent"]);
  });
});
