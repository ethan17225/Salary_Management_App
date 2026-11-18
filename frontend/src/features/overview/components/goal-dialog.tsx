'use client';

import { useRef, useState } from 'react';
import { useDialogs } from '@/components/ui/dialog-provider';
import { updateGoalAction } from '../actions/update-goal';

export function GoalDialogTrigger({ currentGoalCents }: { currentGoalCents: number }) {
  const [goalVal, setGoalVal] = useState('');
  const [goalErr, setGoalErr] = useState('');
  const goalDlgRef = useRef<HTMLDialogElement | null>(null);
  const goalInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useDialogs();

  const openModal = () => {
    setGoalErr('');
    setGoalVal(currentGoalCents ? String(Math.round(currentGoalCents / 100)) : '');
    goalDlgRef.current?.showModal();
    requestAnimationFrame(() => goalInputRef.current?.focus());
  };

  const saveGoal = async (val: string) => {
    const res = await updateGoalAction({ goal: val });
    if (!res.success) {
      setGoalErr(res.error);
      return;
    }
    goalDlgRef.current?.close();
    toast(val ? 'Goal saved' : 'Goal removed');
  };

  return (
    <>
      <button className="btn" type="button" onClick={openModal}>
        {currentGoalCents ? 'Change goal' : 'Set a goal'}
      </button>
      <dialog ref={goalDlgRef} aria-labelledby="goalTitle">
        <form
          className="grid gap-[18px] p-[26px]"
          onSubmit={(e) => {
            e.preventDefault();
            void saveGoal(goalVal);
          }}
        >
          <h2 id="goalTitle" className="text-[22px] font-medium tracking-[-0.02em]">
            Yearly income goal
          </h2>
          <label className="grid gap-1.5 text-sm font-medium">
            Take-home goal for the year
            <span className="relative">
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted font-mono text-[22px]"
                aria-hidden="true"
              >
                $
              </span>
              <input
                ref={goalInputRef}
                type="number"
                step="1"
                min="1"
                inputMode="decimal"
                placeholder="30000"
                className="pl-[34px] font-mono text-2xl min-h-[60px] tracking-[-0.02em]"
                value={goalVal}
                onChange={(e) => setGoalVal(e.target.value)}
              />
            </span>
          </label>
          {goalErr ? (
            <p className="text-down text-sm" role="alert">
              {goalErr}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2.5">
            {currentGoalCents ? (
              <button
                type="button"
                className="btn danger flex-1 sm:flex-initial"
                onClick={() => void saveGoal('')}
              >
                Remove goal
              </button>
            ) : null}
            <span className="hidden sm:block sm:flex-1" />
            <button
              type="button"
              className="btn flex-1 sm:flex-initial"
              onClick={() => goalDlgRef.current?.close()}
            >
              Cancel
            </button>
            <button className="btn primary flex-1 sm:flex-initial">Save goal</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

