import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { StoredUser } from "../../lib/auth-storage";

interface AuthState {
  status: "loading" | "ready";
  user: StoredUser | null;
  companyId: string | null;
  queueIds: string[];
}

const initialState: AuthState = { status: "loading", user: null, companyId: null, queueIds: [] };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{ user: StoredUser; companyId: string; queueIds: string[] }>,
    ) {
      state.status = "ready";
      state.user = action.payload.user;
      state.companyId = action.payload.companyId;
      state.queueIds = action.payload.queueIds;
    },
    clearSession(state) {
      state.status = "ready";
      state.user = null;
      state.companyId = null;
      state.queueIds = [];
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
