export const queryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  tasks: (userId: string) => ["tasks", userId] as const,
  learningPaths: (userId: string) => ["learning-paths", userId] as const,
  skills: (pathId: string) => ["skills", pathId] as const,
  skillProgress: (pathId: string) => ["skill-progress", pathId] as const,
};
