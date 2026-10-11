import { describe, expect, it } from '@jest/globals';
import type { TaskDefinition } from '../tasks/task-registry.js';
import { TaskRegistryService } from '../tasks/task-registry.js';

function fakeTask(name: 'help_question' | 'summarize_conversation'): TaskDefinition {
  return {
    name,
    allowedKinds: ['student', 'tutor'],
    modelChain: ['stub-model'],
    promptVersion: 1,
    maxOutputTokens: 100,
    temperature: 0,
    cacheTtlSeconds: null,
    inputDto: class {},
    run: () =>
      Promise.resolve({
        answer: 'ok',
        model: 'stub-model',
        usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      }),
  };
}

describe('TaskRegistryService', () => {
  it('looks up a registered task by name', () => {
    const help = fakeTask('help_question');
    const registry = new TaskRegistryService([help, fakeTask('summarize_conversation')]);

    expect(registry.get('help_question')).toBe(help);
  });

  it('returns undefined for an unknown task name', () => {
    const registry = new TaskRegistryService([fakeTask('help_question')]);

    expect(registry.get('does_not_exist')).toBeUndefined();
  });

  it('lists every registered task', () => {
    const registry = new TaskRegistryService([
      fakeTask('help_question'),
      fakeTask('summarize_conversation'),
    ]);

    expect(registry.list().map((task) => task.name)).toEqual([
      'help_question',
      'summarize_conversation',
    ]);
  });
});
