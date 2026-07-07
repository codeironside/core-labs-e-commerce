export const taxAnalysisQueue = {
  getJobCounts: async (): Promise<Record<string, number>> => ({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
  }),
};
