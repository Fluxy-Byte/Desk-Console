import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { StoredUser } from "../../lib/auth-storage";

export type AttendantStatus = "ONLINE" | "PAUSED" | "OFFLINE";

interface AuthState {
  status: "loading" | "ready";
  user: StoredUser | null;
  companyId: string | null;
  queueIds: string[];
  attendantStatus: AttendantStatus;
}

const initialState: AuthState = { status: "loading", user: null, companyId: null, queueIds: [], attendantStatus: "OFFLINE" };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{ user: StoredUser; companyId: string; queueIds: string[]; attendantStatus: AttendantStatus }>,
    ) {
      state.status = "ready";
      state.user = action.payload.user;
      state.companyId = action.payload.companyId;
      state.queueIds = action.payload.queueIds;
      state.attendantStatus = action.payload.attendantStatus;
    },
    setAttendantStatus(state, action: PayloadAction<AttendantStatus>) {
      state.attendantStatus = action.payload;
    },
    clearSession(state) {
      state.status = "ready";
      state.user = null;
      state.companyId = null;
      state.queueIds = [];
      state.attendantStatus = "OFFLINE";
    },
  },
});

export const { setSession, setAttendantStatus, clearSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
