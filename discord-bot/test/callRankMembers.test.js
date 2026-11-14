import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCallRankEntriesToCurrentMembers } from '../src/utils/callRank.js';

test('ranking inclui somente IDs retornados como membros atuais do servidor', async () => {
  const entries = [
    { userId: 'member-1', minutes: 120 },
    { userId: 'departed-member', minutes: 90 },
    { userId: 'member-2', minutes: 60 },
  ];
  const guild = {
    id: 'guild-1',
    members: {
      fetch: async ({ user, cache }) => {
        assert.deepEqual(user, ['member-1', 'departed-member', 'member-2']);
        assert.equal(cache, false);
        return new Map([
          ['member-1', { id: 'member-1' }],
          ['member-2', { id: 'member-2' }],
        ]);
      },
    },
  };

  assert.deepEqual(await filterCallRankEntriesToCurrentMembers(guild, entries), [
    { userId: 'member-1', minutes: 120 },
    { userId: 'member-2', minutes: 60 },
  ]);
});

test('ranking divide a validação em lotes de até 100 IDs', async () => {
  const entries = Array.from({ length: 205 }, (_, index) => ({
    userId: `member-${index}`,
    minutes: 300 - index,
  }));
  const batchSizes = [];
  const guild = {
    id: 'guild-1',
    members: {
      fetch: async ({ user }) => {
        batchSizes.push(user.length);
        return new Map(user.map((id) => [id, { id }]));
      },
    },
  };

  const filtered = await filterCallRankEntriesToCurrentMembers(guild, entries);
  assert.deepEqual(batchSizes, [100, 100, 5]);
  assert.equal(filtered.length, entries.length);
});

test('IDs não verificados são omitidos quando a consulta falha', async (t) => {
  t.mock.method(console, 'error', () => {});
  const entries = [
    { userId: 'member-1', minutes: 120 },
    { userId: 'member-2', minutes: 60 },
  ];
  const guild = {
    id: 'guild-1',
    members: {
      fetch: async () => {
        throw Object.assign(new Error('Falha de consulta'), { code: 'TEST' });
      },
    },
  };

  assert.deepEqual(await filterCallRankEntriesToCurrentMembers(guild, entries), []);
});
