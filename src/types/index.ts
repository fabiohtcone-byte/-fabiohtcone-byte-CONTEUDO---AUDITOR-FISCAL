export type TopicStatus = 'not_started' | 'learning' | 'reviewing' | 'mastered';

export interface Topic {
  id: number;
  subjectId: number;
  title: string;
  content: string | null;
}

export interface Subject {
  id: number;
  slug: string;
  title: string;
  topics: Topic[];
}

export interface DailyStudyPlan {
  id: number;
  userId: number;
  topicId: number;
  date: string;
  completed: boolean;
  topic: Topic & { subject: Subject };
}

export interface AppState {
  activeSubjectId: number | null;
  activeTopicId: number | null;
  currentView: 'dashboard' | 'syllabus' | 'tutor';
}

