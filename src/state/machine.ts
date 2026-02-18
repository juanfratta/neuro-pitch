/**
 * Protocol State Machine
 * Controls progression through training protocol
 * 
 * States:
 * idle → training_session_active → session_review → (eligible? yes: training again, no: retention/complete)
 * → week2_retention_test → week4_retention_test → final_test → completed
 */

import type { User, ProtocolState } from '../types';
import { canAdvanceLevel, advanceLevel } from '../services/storage';

export type StateTransition =
  | 'start_training'
  | 'complete_session'
  | 'skip_to_retention'
  | 'take_week2_test'
  | 'take_week4_test'
  | 'take_final_test'
  | 'complete_test'
  | 'fail_protocol'
  | 'reset';

/**
 * Get next valid state based on context
 */
export function getNextState(
  currentState: ProtocolState,
  transition: StateTransition,
  user: User
): ProtocolState {
  switch (currentState) {
    case 'idle':
      if (transition === 'start_training') return 'training_session_active';
      if (transition === 'take_week2_test') return 'week2_retention_test';
      if (transition === 'take_week4_test') return 'week4_retention_test';
      if (transition === 'take_final_test') return 'final_test';
      break;

    case 'training_session_active':
      if (transition === 'complete_session') return 'idle'; // Back to idle after session
      break;

    case 'session_review':
      // Auto-transition based on level advancement
      if (canAdvanceLevel(user)) {
        const advanced = advanceLevel(user);
        if (advanced.current_level === 10) {
          // Completed all levels, ready for tests
          return 'idle'; // Back to idle, can start tests
        }
        return 'idle'; // Ready for next level
      }
      return 'idle'; // Stay at current level, continue training

    case 'week2_retention_test':
      if (transition === 'complete_test') return 'idle';
      break;

    case 'week4_retention_test':
      if (transition === 'complete_test') return 'idle';
      break;

    case 'final_test':
      if (transition === 'complete_test') return 'completed';
      break;

    case 'completed':
      if (transition === 'reset') return 'idle';
      break;

    case 'failed':
      if (transition === 'reset') return 'idle';
      break;
  }

  // Invalid transition - return current state
  console.warn(`Invalid state transition: ${currentState} -> ${transition}`);
  return currentState;
}

/**
 * State machine instance
 */
export class ProtocolStateMachine {
  private currentState: ProtocolState = 'idle';
  private user: User;

  constructor(user: User) {
    this.user = user;
  }

  /**
   * Attempt state transition
   */
  transition(transitionType: StateTransition): { success: boolean; newState: ProtocolState } {
    const newState = getNextState(this.currentState, transitionType, this.user);

    if (newState === this.currentState && transitionType !== 'reset') {
      return { success: false, newState };
    }

    this.currentState = newState;
    return { success: true, newState };
  }

  /**
   * Get current state
   */
  getState(): ProtocolState {
    return this.currentState;
  }

  /**
   * Set state manually (for testing or debug)
   */
  setState(state: ProtocolState): void {
    console.warn(`Manually setting state to ${state} (debug)`);
    this.currentState = state;
  }

  /**
   * Update user for context-dependent transitions
   */
  setUser(user: User): void {
    this.user = user;
  }

  /**
   * Get valid next transitions from current state
   */
  getValidTransitions(): StateTransition[] {
    const transitions: StateTransition[] = [];

    switch (this.currentState) {
      case 'idle':
        transitions.push('start_training', 'take_week2_test', 'take_week4_test', 'take_final_test');
        break;

      case 'training_session_active':
        transitions.push('complete_session');
        break;

      case 'session_review':
        transitions.push('reset');
        break;

      case 'week2_retention_test':
      case 'week4_retention_test':
      case 'final_test':
        transitions.push('complete_test');
        break;

      case 'completed':
        transitions.push('reset');
        break;

      case 'failed':
        transitions.push('reset');
        break;
    }

    return transitions;
  }

  /**
   * Check if in training state
   */
  isTraining(): boolean {
    return this.currentState === 'training_session_active';
  }

  /**
   * Check if in test state
   */
  isInTest(): boolean {
    return ['week2_retention_test', 'week4_retention_test', 'final_test'].includes(
      this.currentState
    );
  }

  /**
   * Should feedback be shown?
   */
  shouldShowFeedback(): boolean {
    // Show feedback during training, not during tests
    return this.currentState === 'training_session_active';
  }

  /**
   * Get readable state name for UI
   */
  getStateLabel(): string {
    const labels: { [key in ProtocolState]: string } = {
      idle: 'Ready for next activity',
      training_session_active: 'Training session',
      session_review: 'Session complete - reviewing metrics',
      week2_retention_test: 'Week 2 Retention Test',
      week4_retention_test: 'Week 4 Retention Test',
      final_test: 'Final Test - Full Protocol Evaluation',
      completed: 'Protocol Complete',
      failed: 'Protocol Failed',
    };

    return labels[this.currentState];
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentState = 'idle';
  }
}

/**
 * Command pattern: Actions that interact with state machine
 */
export type ProtocolAction =
  | { type: 'start_session'; level: number }
  | { type: 'finish_session'; sessionId: string }
  | { type: 'advance_level' }
  | { type: 'start_retention_test'; week: number }
  | { type: 'complete_retention_test'; week: number; passed: boolean }
  | { type: 'start_final_test' }
  | { type: 'complete_final_test'; passed: boolean }
  | { type: 'fail_user' }
  | { type: 'reset_protocol' };

/**
 * Process action through state machine
 */
export function processAction(machine: ProtocolStateMachine, action: ProtocolAction): void {
  switch (action.type) {
    case 'start_session':
      machine.transition('start_training');
      break;

    case 'finish_session':
      machine.transition('complete_session');
      break;

    case 'advance_level':
      machine.transition('reset'); // User ready for next cycle
      break;

    case 'start_retention_test':
      if (action.week === 2) {
        machine.transition('take_week2_test');
      } else if (action.week === 4) {
        machine.transition('take_week4_test');
      }
      break;

    case 'complete_retention_test':
      machine.transition('complete_test');
      break;

    case 'start_final_test':
      machine.transition('take_final_test');
      break;

    case 'complete_final_test':
      machine.transition('complete_test');
      break;

    case 'fail_user':
      // User failed to meet protocol criteria - mark as failed
      machine.setState('failed');
      break;

    case 'reset_protocol':
      machine.reset();
      break;
  }
}
