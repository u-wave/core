import { expect } from 'chai';
import mongoose from 'mongoose';
import uwave from '../src';
import userModel from '../src/models/User';
import aclRoleModel from '../src/models/AclRole';
import usersPlugin from '../src/plugins/users';
import aclPlugin from '../src/plugins/acl';
import createUser from './utils/createUser';

const DB_NAME = 'uw_test_acl';

function createUwaveWithAclTest() {
  const uw = uwave({
    useDefaultPlugins: false,
    mongo: mongoose.createConnection(`mongodb://localhost/${DB_NAME}`),
  });
  uw.use(userModel());
  uw.use(aclRoleModel());
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
    await uw.mongo.dropDatabase();
    await uw.stop();
  });

  it('can check if a user is not allowed to do something', async () => {
    expect(await acl.isAllowed(user, 'test.role')).to.equal(false);
  });

  it('disallows nonexistent roles by default', async () => {
    expect(await acl.isAllowed(user, 'something.that.is.not.allowed')).to.equal(false);
  });

  it('can allow users to do things', async () => {
    expect(await acl.isAllowed(user, 'test.role')).to.equal(false);

    await acl.allow(user, ['test.role']);
    expect(await acl.isAllowed(user, 'test.role')).to.equal(true);
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
    expect(await acl.isAllowed(user, 'universe.create')).to.equal(true);
  });

  it('can remove permissions from users', async () => {
    await acl.allow(user, ['test.role']);
    expect(await acl.isAllowed(user, 'test.role')).to.equal(true);

    await acl.disallow(user, ['test.role']);
    expect(await acl.isAllowed(user, 'test.role')).to.equal(false);
  });

  it('provides convenience methods on the User model class', async () => {
    await acl.createRole('waitlist.add', []);
    await acl.createRole('waitlist.remove', []);
    await acl.createRole('waitlist.clear', []);
    await acl.createRole('moderate.waitlist', ['waitlist.add', 'waitlist.remove']);

    await user.allow(['moderate.waitlist']);

    expect(await user.can('waitlist.add')).to.equal(true);
    expect(await user.can('waitlist.remove')).to.equal(true);
    expect(await user.can('waitlist.clear')).to.equal(false);
  });
});
