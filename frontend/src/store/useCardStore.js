import { create } from 'zustand';

// Everything the card holds for one member. Wiped wholesale when the signed-in
// account changes, because the store is a module-level singleton that outlives
// any single sign-in.

// The picture slot's state.
//
// previewUrl and processedUrl are deliberately both here: previewUrl is the
// member's own crop rendered locally, so the slot fills the instant they hit
// "Use photo", while processedUrl is the Cloudinary URL the server has since
// stored (api/memberApi.js). The card renders processedUrl first
// (CardPreviewOverlay.jsx), so the export rasterises the stored image, and
// previewUrl is what keeps the slot filled when there is no session or the
// upload failed.
function emptyPhoto() {
  return {
    file: null,
    cropRect: null, // { x, y, width, height }
    previewUrl: null, // local data URL, shown instantly before the upload confirms
    processedUrl: null, // Cloudinary URL once the server has stored it
    status: 'idle', // 'idle' | 'uploading' | 'ready' | 'error'
    error: null,
  };
}

// A reload finds the stored photo on the user payload (the backend keeps the
// Cloudinary URL on the user document, models/user.js) and has nothing local, so
// the saved picture comes back as the photo rather than as a fresh empty slot.
// Both URLs are set: there is no local crop to fall back on, and the card
// exports from processedUrl.
function storedPhoto(user) {
  const url = user?.photo?.url;
  if (!url) return emptyPhoto();
  return { ...emptyPhoto(), previewUrl: url, processedUrl: url, status: 'ready' };
}

function freshCardState() {
  return {
    ownerId: null,
    fields: {},
    // The server-allocated member id is the one field the member cannot type,
    // so its fetch has to be observable: a silent failure would leave the card
    // permanently unable to pass validation with nothing on screen to explain
    // why. 'idle' | 'loading' | 'ready' | 'error'.
    memberIdStatus: 'idle',
    // Bumped by retryMemberId() to re-run the allocation request.
    memberIdRetry: 0,
    photo: emptyPhoto(),
    status: 'idle',
    result: null,
    error: null,
  };
}

// The card details captured at registration. memberId is not typed by the
// member: authController allocates it on signup/login, so it rides in on the
// same user document as everything else and lands here like any other field.
// It is only absent for a profile cached before that existed — see the
// fallback request in pages/LandingPage.jsx.
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
    memberId: user.memberId,
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
  memberIdStatus: 'idle',
  memberIdRetry: 0,

  photo: emptyPhoto(),

  status: 'idle', // 'idle' | 'submitting' | 'done' | 'error'
  result: null, // { frontImageUrl, backImageUrl, pdfUrl }
  error: null,

  setTemplateConfig: (templateConfig) => set({ templateConfig }),
  setSubmissionId: (submissionId) => set({ submissionId }),

  setMemberIdStatus: (memberIdStatus) => set({ memberIdStatus }),

  /** Re-asks the server for the member id after a failed allocation. */
  retryMemberId: () =>
    set((state) => ({
      memberIdStatus: 'loading',
      memberIdRetry: state.memberIdRetry + 1,
    })),

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
        return {
          ...freshCardState(),
          currentSide: state.currentSide,
          ownerId,
          fields: withoutBlanks(seed),
          photo: storedPhoto(user),
        };
      }

      const fields = { ...state.fields };
      let changed = false;
      for (const [key, value] of Object.entries(seed)) {
        if (!value || fields[key]) continue;
        fields[key] = value;
        changed = true;
      }

      // Top up the photo the same way. Only when nothing is pending locally, so
      // a re-hydrate can never overwrite the picture this member is looking at
      // or one that is still uploading.
      if (!changed && state.photo.status === 'idle' && !state.photo.previewUrl && user?.photo?.url) {
        return { photo: storedPhoto(user) };
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
