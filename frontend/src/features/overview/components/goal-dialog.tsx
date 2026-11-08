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
          onSubmit={(e) => {
            e.preventDefault();
            void saveGoal(goalVal);
          }}
        >
          <h2 id="goalTitle">Yearly income goal</h2>
          <label className="field">
            Take-home goal for the year
            <span className="money-in">
              <span aria-hidden="true">$</span>
              <input
                ref={goalInputRef}
                type="number"
                step="1"
                min="1"
                inputMode="decimal"
                placeholder="30000"
                value={goalVal}
                onChange={(e) => setGoalVal(e.target.value)}
              />
            </span>
          </label>
          <p className="err" role="alert">
            {goalErr}
          </p>
          <div className="actions">
            {currentGoalCents ? (
              <button type="button" className="btn danger" onClick={() => void saveGoal('')}>
                Remove goal
              </button>
            ) : null}
            <span className="sp" />
            <button type="button" className="btn" onClick={() => goalDlgRef.current?.close()}>
              Cancel
            </button>
            <button className="btn primary">Save goal</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

