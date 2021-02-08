'use strict';

const assert = require('assert');
const createUwave = require('./utils/createUwave');

describe('ACL', () => {
  let user;
  let uw;
  beforeEach(async () => {
    uw = await createUwave('acl');
    user = await uw.test.createUser();

    await uw.acl.createRole('test.role', []);
  });
  afterEach(async () => {
    await uw.destroy();
  });

  it('can check if a user is not allowed to do something', async () => {
    assert.strictEqual(await uw.acl.isAllowed(user, 'test.role'), false);
  });

  it('disallows nonexistent roles by default', async () => {
    assert.strictEqual(await uw.acl.isAllowed(user, 'something.that.is.not.allowed'), false);
  });

  it('can allow users to do things', async () => {
    assert.strictEqual(await uw.acl.isAllowed(user, 'test.role'), false);

    await uw.acl.allow(user, ['test.role']);
    assert.strictEqual(await uw.acl.isAllowed(user, 'test.role'), true);
  });

  it('can create new roles, grouping existing roles', async () => {
    await uw.acl.createRole('group.of.roles', [
      'test.role',
      'some.other.role',
      'universe.destroy',
      'universe.create',
    ]);
    await uw.acl.createRole('other.group.of.roles', [
      'strawberry.eat',
    ]);

    await uw.acl.allow(user, ['group.of.roles']);
    assert.strictEqual(await uw.acl.isAllowed(user, 'universe.create'), true);
  });

  it('can remove permissions from users', async () => {
    await uw.acl.allow(user, ['test.role']);
    assert.strictEqual(await uw.acl.isAllowed(user, 'test.role'), true);

    await uw.acl.disallow(user, ['test.role']);
    assert.strictEqual(await uw.acl.isAllowed(user, 'test.role'), false);
  });

  it('can delete roles', async () => {
    await uw.acl.createRole('test.role', []);
    assert(Object.keys(await uw.acl.getAllRoles()).includes('test.role'));
    await uw.acl.deleteRole('test.role');
    assert(!Object.keys(await uw.acl.getAllRoles()).includes('test.role'));
  });
});
