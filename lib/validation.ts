import { z } from "zod";
const answer = z
  .string()
  .trim()
  .min(2, "Напишіть щонайменше 2 символи.")
  .max(1500, "Не більше 1500 символів.");
const common = {
  request_id: z.uuid(),
  website: z.literal(""),
  started_at: z
    .number()
    .finite()
    .refine(
      (t) => Date.now() - t >= 2000 && Date.now() - t <= 172800000,
      "Оновіть сторінку та спробуйте ще раз.",
    ),
};
export const letterSchema = z
  .object({
    ...common,
    child: z.enum(["vladyslav", "liliia"]),
    answers: z
      .object({
        identity: answer.max(200),
        resemblance: answer,
        character: answer,
        future: answer,
        wishes: answer,
      })
      .strict(),
  })
  .strict();
export const rsvpSchema = z
  .object({
    ...common,
    guest_name: answer.max(200),
    attending: z.boolean(),
    guests: z.number().int().min(1).max(20),
    comment: z.string().trim().max(1500),
  })
  .strict();
