import { z } from "zod";

export const FeedbackRatingSchema = z.enum(["up", "down"]);
export type FeedbackRating = z.infer<typeof FeedbackRatingSchema>;

/** 1 lần gửi feedback cho 1 reply (đưa vào FeedbackSink đã resolve). */
export const FeedbackSchema = z.object({
  messageId: z.string(), // message assistant đích
  rating: FeedbackRatingSchema,
  comment: z.string().optional(), // free-text ("feedback message"), optional
});
export type Feedback = z.infer<typeof FeedbackSchema>;
