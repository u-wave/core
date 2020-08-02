const assert = require('assert');
const uwave = require('..');
const usersPlugin = require('../src/plugins/users');
const aclPlugin = require('../src/plugins/acl');
const createUser = require('./utils/createUser');
const mongoConnected = require('./utils/mongoConnected');

const DB_NAME = 'uw_test_acl';

function createUwaveWithAclTest() {
  const uw = uwave({
    useDefaultPlugins: false,
    mongo: `mongodb://localhost/${DB_NAME}`,
    secret: Buffer.from(`secret_${DB_NAME}`),
  });
  uw.use(usersPlugin());
  uw.use(aclPlugin({ defaultRoles: false }));
  return uw;
}

describe('acl', () => {
  let user;
  let uw;
  let acl;
  beforeEach(async () => {
    uw = await createUwaveWithAclTest();
    acl = uw.acl; // eslint-disable-line prefer-destructuring
    await acl.createRole('test.role', []);
    user = createUser(uw);
  });
  afterEach(async () => {
    await mongoConnected(uw.mongo);
    await uw.mongo.dropDatabase();
    await uw.stop();
  });

  it('can check if a user is not allowed to do something', async () => {
    assert.strictEqual(await acl.isAllowed(user, 'test.role'), false);
  });

  it('disallows nonexistent roles by default', async () => {
    assert.strictEqual(await acl.isAllowed(user, 'something.that.is.not.allowed'), false);
  });

  it('can allow users to do things', async () => {
    assert.strictEqual(await acl.isAllowed(user, 'test.role'), false);

    await acl.allow(user, ['test.role']);
    assert.strictEqual(await acl.isAllowed(user, 'test.role'), true);
  });

  it('can create new roles, grouping existing roles', async () => {
    await acl.createRole('group.of.roles', [
      'test.role',
      'some.other.role',
      'universe.destroy',
      'universe.create',
    ]);
    await acl.createRole('other.group.of.roles', [
      'strawberry.eat',
    ]);

    await acl.allow(user, ['group.of.roles']);
    assert.strictEqual(await acl.isAllowed(user, 'universe.create'), true);
  });

  it('can remove permissions from users', async () => {
    await acl.allow(user, ['test.role']);
    assert.strictEqual(await acl.isAllowed(user, 'test.role'), true);

    await acl.disallow(user, ['test.role']);
    assert.strictEqual(await acl.isAllowed(user, 'test.role'), false);
  });

  it('provides convenience methods on the User model class', async () => {
    await acl.createRole('waitlist.add', []);
    await acl.createRole('waitlist.remove', []);
    await acl.createRole('waitlist.clear', []);
    await acl.createRole('moderate.waitlist', ['waitlist.add', 'waitlist.remove']);

    await user.allow(['moderate.waitlist']);

    assert.strictEqual(await user.can('waitlist.add'), true);
    assert.strictEqual(await user.can('waitlist.remove'), true);
    assert.strictEqual(await user.can('waitlist.clear'), false);
  });

  it('can delete roles', async () => {
    await acl.createRole('test.role', []);
    assert.deepStrictEqual(Object.keys(await acl.getAllRoles()), ['test.role']);
    await acl.deleteRole('test.role');
    assert.deepStrictEqual(Object.keys(await acl.getAllRoles()), []);
  });
});
