export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  recurrenceId?: string;
  reminderAt?: string;
};

export type RepeatRule = {
  id: string;
  title: string;
  lastCreatedDate: string;
  active: boolean;
  daysOfWeek?: number[];
};
