// Keep local submissions available; cloud builds use browser drafts until storage is connected.
export const submissionsEnabled = process.env.NEXT_PUBLIC_SUBMISSIONS_ENABLED !== "false";
