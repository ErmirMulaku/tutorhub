/** The Reviews API's shapes (moved from the dashboard's core/api/models.ts). */
export type ReviewFilter = 'all' | 'unreplied' | 'replied';
export interface TutorReview {
  id: string;
  studentName: string;
  studentAvatarColor: string | null;
  subjectName: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  createdAt: string;
}
export interface ReviewSummary {
  average: number;
  count: number;
  distribution: number[];
}
