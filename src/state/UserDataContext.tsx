import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { applyAttempt, retreat as retreatProgress, type AttemptSummary, type TrialRecord } from '../protocol/progression';
import { reportTest } from '../protocol/assessment';
import {
  compactTrial,
  createUserData,
  loadUserData,
  saveUserData,
  type AttemptKind,
  type AttemptRecord,
  type TestKind,
  type TestRecord,
  type UserData,
} from './userData';
import type { Outcome, ProgressState } from '../protocol/progression';

export interface LevelAttemptInput {
  kind: AttemptKind;
  startedAt: Date;
  windowMs: number;
  feedback: boolean;
  trials: TrialRecord[];
  summary: AttemptSummary;
}

interface UserDataContextValue {
  data: UserData;
  recordAttempt: (input: LevelAttemptInput) => { outcome: Outcome | null; passed: boolean; progress: ProgressState };
  recordTest: (kind: TestKind, startedAt: Date, trials: TrialRecord[]) => TestRecord;
  retreat: () => void;
  /** Solo para modo desarrollo. */
  setProgress: (progress: ProgressState) => void;
  reset: () => void;
  replace: (data: UserData) => void;
}

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<UserData>(loadUserData);

  const commit = useCallback((next: UserData) => {
    saveUserData(next);
    setData(next);
  }, []);

  const recordAttempt = useCallback<UserDataContextValue['recordAttempt']>(
    (input) => {
      const now = new Date();
      let progress = data.progress;
      let outcome: Outcome | null = null;
      let passed = input.summary.accuracy >= 90;

      if (input.kind === 'level') {
        const result = applyAttempt(data.progress, input.summary);
        progress = result.state;
        outcome = result.outcome;
        passed = result.passed;
      } else if (input.kind === 'special-no-feedback') {
        progress = { ...data.progress, attemptsSinceSpecial: 0 };
      }

      const record: AttemptRecord = {
        kind: input.kind,
        stage: data.progress.stage,
        level: data.progress.level,
        startedAt: input.startedAt.toISOString(),
        endedAt: now.toISOString(),
        windowMs: input.windowMs,
        feedback: input.feedback,
        summary: input.summary,
        passed,
        outcome,
        trials: input.trials.map(compactTrial),
      };

      commit({ ...data, progress, attempts: [...data.attempts, record], lastTrainingAt: now.toISOString() });
      return { outcome, passed, progress };
    },
    [data, commit]
  );

  const recordTest = useCallback<UserDataContextValue['recordTest']>(
    (kind, startedAt, trials) => {
      const record: TestRecord = {
        kind,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        report: reportTest(trials),
        trials: trials.map(compactTrial),
      };
      commit({ ...data, tests: [...data.tests, record] });
      return record;
    },
    [data, commit]
  );

  const value = useMemo<UserDataContextValue>(
    () => ({
      data,
      recordAttempt,
      recordTest,
      retreat: () => commit({ ...data, progress: retreatProgress(data.progress) }),
      setProgress: (progress) => commit({ ...data, progress }),
      reset: () => commit(createUserData()),
      replace: commit,
    }),
    [data, recordAttempt, recordTest, commit]
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData fuera de UserDataProvider');
  return ctx;
}
