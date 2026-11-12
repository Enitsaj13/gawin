export type TaskSchedule = {
  scheduledTime?: string;
  scheduledAt?: string;
  timeZone?: string;
  reminderMinutes?: number;
  reminderAt?: string;
};

export type Todo = TaskSchedule & {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  recurrenceId?: string;
};

export type RepeatRule = {
  id: string;
  title: string;
  lastCreatedDate: string;
  active: boolean;
  daysOfWeek?: number[];
};
