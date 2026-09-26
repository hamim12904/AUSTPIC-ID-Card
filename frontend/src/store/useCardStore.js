import { create } from 'zustand';

// Everything the card holds for one member. Wiped wholesale when the signed-in
// account changes, because the store is a module-level singleton that outlives
// any single sign-in.
function freshCardState() {
  return {
    ownerId: null,
    fields: {},
    photo: { file: null, cropRect: null, previewUrl: null, processedUrl: null },
    status: 'idle',
    result: null,
    error: null,
  };
}

// The card details captured at registration. memberId is deliberately absent:
// it is allocated server-side by memberController, not typed by the member.
function profileFields(user) {
  if (!user) return {};
  return {
    name: user.name,
    email: user.email,
    studentId: user.studentId,
    department: user.department,
    bloodGroup: user.bloodGroup,
    contact: user.contact,
    address: user.address,
  };
}

function withoutBlanks(seed) {
  const fields = {};
  for (const [key, value] of Object.entries(seed)) {
    if (value) fields[key] = value;
  }
  return fields;
}

/**
 * Single source of truth shared across Hero -> CardStage -> ReviewExport.
 *
 * status flow:
 *   idle -> submitting -> done | error
 * currentSide flow:
 *   'front' -> 'back'
 */
export const useCardStore = create((set, get) => ({
  templateConfig: null,
  submissionId: null,

  currentSide: 'front',
  // Whose card this is, by user id. Guards against one member's entries
  // showing up on another member's card. See syncWithUser.
  ownerId: null,
  fields: {}, // { name, studentId, department, bloodGroup, contact, memberId, address, email }

  photo: {
    file: null,
    cropRect: null, // { x, y, width, height }
    previewUrl: null, // local object URL, shown instantly before upload confirms
    processedUrl: null, // backend-processed URL once uploaded
  },

  status: 'idle', // 'idle' | 'submitting' | 'done' | 'error'
  result: null, // { frontImageUrl, backImageUrl, pdfUrl }
  error: null,

  setTemplateConfig: (templateConfig) => set({ templateConfig }),
  setSubmissionId: (submissionId) => set({ submissionId }),

  setField: (key, value) =>
    set((state) => ({ fields: { ...state.fields, [key]: value } })),

  setFields: (patch) =>
    set((state) => ({ fields: { ...state.fields, ...patch } })),

  /**
   * Points the card at the signed-in account and seeds it from that profile.
   *
   * A different account wipes the card first. Without this, signing in as a
   * second member would leave the first member's typed values on the card, and
   * the blank-only fill below would never replace them — the new member would
   * have to refresh the page to see their own details. Signing out passes null
   * and clears it for the same reason.
   *
   * The same account only tops up blanks, so a refresh (the store starts empty
   * while the profile persists in localStorage) restores the saved details
   * without discarding edits the member has made since.
   */
  syncWithUser: (user) =>
    set((state) => {
      const ownerId = user?.id ?? null;
      const seed = profileFields(user);

      if (ownerId !== state.ownerId) {
        return { ...freshCardState(), currentSide: state.currentSide, ownerId, fields: withoutBlanks(seed) };
      }

      const fields = { ...state.fields };
      let changed = false;
      for (const [key, value] of Object.entries(seed)) {
        if (!value || fields[key]) continue;
        fields[key] = value;
        changed = true;
      }
      return changed ? { fields } : state;
    }),

  setPhoto: (photoPatch) =>
    set((state) => ({ photo: { ...state.photo, ...photoPatch } })),

  flipSide: () =>
    set((state) => ({
      currentSide: state.currentSide === 'front' ? 'back' : 'front',
    })),

  setSide: (side) => set({ currentSide: side }),

  setStatus: (status) => set({ status }),
  setResult: (result) => set({ status: 'done', result }),
  setError: (error) => set({ error }),

  reset: () =>
    set({
      ...freshCardState(),
      currentSide: 'front',
    }),
}));
