import { getUserFriendlyFirebaseError } from "./firebaseError";

test("does not expose raw Firebase permission errors to field users", () => {
  expect(
    getUserFriendlyFirebaseError(
      { code: "permission-denied", message: "raw internal rules message" },
      "Fallback"
    )
  ).toBe("You do not have permission to complete this action. Contact an administrator.");
});

test("returns a practical retry message for network failures", () => {
  expect(
    getUserFriendlyFirebaseError({ code: "unavailable" }, "Fallback")
  ).toBe("Unable to connect right now. Check your internet connection and try again.");
});

test("uses a page-specific fallback for other Firebase errors", () => {
  expect(
    getUserFriendlyFirebaseError({ code: "unknown" }, "Site update could not be submitted.")
  ).toBe("Site update could not be submitted.");
});
