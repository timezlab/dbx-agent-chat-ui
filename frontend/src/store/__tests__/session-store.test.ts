import { beforeEach, describe, expect, it } from "vitest";

import { resetSessionStore, useSessionStore } from "@/store/session-store";

beforeEach(() => {
  resetSessionStore();
});

describe("session store (US2)", () => {
  it("starts with no conversation opened (empty screen) and no agent", () => {
    const s = useSessionStore.getState();
    expect(s.conversationId).toBeNull();
    expect(s.selectedAgentId).toBeNull();
  });

  it("setConversationId points the store at an existing conversation", () => {
    useSessionStore.getState().setConversationId("c-123");
    expect(useSessionStore.getState().conversationId).toBe("c-123");
  });

  it("newConversationId mints a fresh id, sets it, and returns it", () => {
    const id = useSessionStore.getState().newConversationId();
    expect(id).toBeTruthy();
    expect(useSessionStore.getState().conversationId).toBe(id);
    const next = useSessionStore.getState().newConversationId();
    expect(next).not.toBe(id);
  });

  it("selectAgent stores the selection", () => {
    useSessionStore.getState().selectAgent("a2");
    expect(useSessionStore.getState().selectedAgentId).toBe("a2");
    useSessionStore.getState().selectAgent(null);
    expect(useSessionStore.getState().selectedAgentId).toBeNull();
  });

  it("persists the session pointers to localStorage", () => {
    useSessionStore.getState().setConversationId("c-persist");
    useSessionStore.getState().selectAgent("a-persist");
    const raw = window.localStorage.getItem("dbx-agent-session");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.conversationId).toBe("c-persist");
    expect(parsed.state.selectedAgentId).toBe("a-persist");
    // config is env-derived — it must NOT be persisted.
    expect(parsed.state.config).toBeUndefined();
  });

  it("rehydrate() reads the persisted pointers back and flips _hasHydrated", async () => {
    // Simulate a fresh page load with `skipHydration`: pointers already on disk, in-memory
    // state still at defaults. Seed `localStorage` DIRECTLY — going through setState would
    // re-persist and defeat the point (persist writes on every state change).
    window.localStorage.setItem(
      "dbx-agent-session",
      JSON.stringify({
        state: { conversationId: "c-restore", selectedAgentId: "a-restore" },
        version: 0,
      }),
    );
    expect(useSessionStore.getState().conversationId).toBeNull(); // not hydrated yet

    await useSessionStore.persist.rehydrate();

    const s = useSessionStore.getState();
    expect(s._hasHydrated).toBe(true);
    expect(s.conversationId).toBe("c-restore");
    expect(s.selectedAgentId).toBe("a-restore");
  });

  it("resetSessionStore clears selection and pointers", () => {
    useSessionStore.getState().setConversationId("c-1");
    useSessionStore.getState().selectAgent("a-1");
    resetSessionStore();
    const s = useSessionStore.getState();
    expect(s.conversationId).toBeNull();
    expect(s.selectedAgentId).toBeNull();
  });
});
