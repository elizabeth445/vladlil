import { submit } from "@/lib/submission";
export const runtime = "nodejs";
export const POST = (request: Request) => submit(request, "rsvp");
