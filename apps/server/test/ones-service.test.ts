import assert from 'node:assert/strict';
import test from 'node:test';
import { mapSearchableOnesUsers } from '../src/modules/ones/service.ts';

test('mapSearchableOnesUsers filters out users without email', () => {
  const result = mapSearchableOnesUsers([
    {
      id: 'user-1',
      name: '张三',
      email: 'zhangsan@example.com',
      staffID: 'A001'
    },
    {
      id: 'user-2',
      name: '李四',
      staffID: 'A002'
    },
    {
      id: 'user-3',
      name: '王五',
      email: '   '
    },
    {
      id: 'user-4',
      name: '赵六',
      email: ' zhaoliu@example.com '
    }
  ]);

  assert.deepEqual(result, [
    {
      uuid: 'user-1',
      name: '张三',
      email: 'zhangsan@example.com',
      staffID: 'A001'
    },
    {
      uuid: 'user-4',
      name: '赵六',
      email: 'zhaoliu@example.com',
      staffID: null
    }
  ]);
});
