'use strict';

const { flatten } = require('lodash');
const createDebug = require('debug');
const defaultRoles = require('../config/defaultRoles');
const routes = require('../routes/acl');

const debug = createDebug('uwave:acl');

async function getSubRoles(role) {
  if (role.roles.length === 0) {
    return [role];
  }
  if (!(role.roles[0] instanceof role.constructor)) {
    role.populate('roles');
    await role.execPopulate();
  }

  const roles = await Promise.all(role.roles.map(getSubRoles));
  roles.unshift(role);
  return flatten(roles);
}

async function getAllUserRoles(user) {
  if (user.roles.length === 0) {
    return [];
  }

  user.populate('roles');
  await user.execPopulate('roles');
  const roles = await Promise.all(user.roles.map(getSubRoles));
  return flatten(roles);
}

const getRoleName = (role) => (
  typeof role === 'string' ? role : role.id
);

class Acl {
  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.uw = uw;
    this.superRole = '*';
  }

  async maybeAddDefaultRoles() {
    const { AclRole } = this.uw.models;

    const existingRoles = await AclRole.estimatedDocumentCount();
    debug('existing roles', existingRoles);
    if (existingRoles === 0) {
      debug('no roles found, adding defaults');
      for (const [roleName, permissions] of Object.entries(defaultRoles)) {
        // eslint-disable-next-line no-await-in-loop
        await this.createRole(roleName, permissions);
      }
    }
  }

  async getAclRoles(names, options = {}) {
    const { AclRole } = this.uw.models;

    const existingRoles = await AclRole.find({ _id: { $in: names } });
    const newNames = names.filter((name) => (
      !existingRoles.some((role) => role.id === name)
    ));
    if (options.create && newNames.length > 0) {
      const newRoles = await AclRole.create(newNames.map((name) => ({ _id: name })));
      existingRoles.push(...newRoles);
    }
    return existingRoles;
  }

  getAclUser(user) {
    return this.uw.users.getUser(user);
  }

  async getAllRoles() {
    const { AclRole } = this.uw.models;

    const roles = await AclRole.find().lean();
    return roles.reduce((map, role) => Object.assign(map, {
      [role._id]: role.roles,
    }), {});
  }

  async createRole(name, permissions) {
    const { AclRole } = this.uw.models;

    const roles = await this.getAclRoles(permissions, { create: true });
    await AclRole.findByIdAndUpdate(
      name,
      { roles },
      { upsert: true },
    );

    const subRoles = await Promise.all(roles.map(getSubRoles));
    return {
      name,
      permissions: flatten(subRoles).map((role) => role._id),
    };
  }

  async deleteRole(name) {
    const { AclRole } = this.uw.models;

    await AclRole.deleteOne({ _id: name });
  }

  async allow(user, roleNames) {
    const aclRoles = await this.getAclRoles(roleNames);
    const aclUser = await this.getAclUser(user);

    aclUser.roles.push(...aclRoles);

    await aclUser.save();

    this.uw.publish('acl:allow', {
      userID: aclUser.id,
      roles: aclRoles.map((role) => role.id),
    });
  }

  async disallow(user, roleNames) {
    const aclRoles = await this.getAclRoles(roleNames);
    const aclUser = await this.getAclUser(user);
    const shouldRemove = (roleName) => aclRoles.some((remove) => remove.id === roleName);
    aclUser.roles = aclUser.roles.filter((role) => !shouldRemove(getRoleName(role)));
    await aclUser.save();

    this.uw.publish('acl:disallow', {
      userID: aclUser.id,
      roles: aclRoles.map((role) => role.id),
    });
  }

  async getAllPermissions(user) {
    const aclUser = await this.getAclUser(user);
    const roles = await getAllUserRoles(aclUser);
    return roles.map((role) => role.id);
  }

  async isAllowed(user, permission) {
    const { AclRole } = this.uw.models;

    const role = await AclRole.findById(permission);
    if (!role) {
      return false;
    }

    const aclUser = await this.getAclUser(user);
    const userRoles = await getAllUserRoles(aclUser);
    const roleIds = userRoles.map((userRole) => userRole.id);

    debug('role ids', roleIds, 'check', aclUser, role.id, 'super', this.superRole);

    return roleIds.includes(role.id) || roleIds.includes(this.superRole);
  }
}

async function acl(uw) {
  uw.acl = new Acl(uw);
  uw.httpApi.use('/roles', routes());

  uw.after(async () => {
    await uw.acl.maybeAddDefaultRoles();
  });
}

module.exports = acl;
module.exports.Acl = Acl;
