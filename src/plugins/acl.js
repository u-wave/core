'use strict';

const { flatten } = require('lodash');
const debug = require('debug')('uwave:acl');
const defaultRoles = require('../config/defaultRoles');
const routes = require('../routes/acl');

/**
 * @typedef {import('../models').AclRole} AclRole
 * @typedef {import('../models').User} User
 * @typedef {{ roles: AclRole[] }} PopulateRoles
 * @typedef {AclRole & PopulateRoles} PopulatedAclRole
 */

/**
 * @param {AclRole | PopulatedAclRole} role
 * @returns {Promise<AclRole[]>}
 */
async function getSubRoles(role) {
  if (role.roles.length === 0) {
    return [role];
  }

  // This function juggles the `.roles` type a bit between strings and AclRole instances,
  // and typescript does not like that!
  // @ts-ignore
  if (!(role.roles[0] instanceof role.constructor)) {
    role.populate('roles');
    await role.execPopulate();
  }

  /** @type {AclRole[]} */
  // @ts-ignore
  const relatedRoles = role.roles;

  const roles = await Promise.all(relatedRoles.map(getSubRoles));
  return [role, ...flatten(roles)];
}

/**
 * @param {User} user
 * @returns {Promise<AclRole[]>}
 */
async function getAllUserRoles(user) {
  if (user.roles.length === 0) {
    return [];
  }

  user.populate('roles');
  await user.execPopulate();

  /** @type {AclRole[]} */
  // @ts-ignore
  const baseRoles = user.roles;

  const roles = await Promise.all(baseRoles.map(getSubRoles));
  return flatten(roles);
}

/**
 * @param {AclRole|string} role
 * @returns {string}
 */
function getRoleName(role) {
  return typeof role === 'string' ? role : role.id;
}

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

  /**
   * @param {string[]} names
   * @param {{ create?: boolean }} [options]
   * @returns {Promise<AclRole[]>}
   */
  async getAclRoles(names, options = {}) {
    const { AclRole } = this.uw.models;

    /** @type {AclRole[]} */
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

  /**
   * @param {import('mongodb').ObjectID} userID
   * @returns {Promise<User>}
   */
  getAclUser(userID) {
    return this.uw.users.getUser(userID);
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
      { roles: roles.map((role) => role._id) },
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

  /**
   * @param {User} user
   * @param {string[]} roleNames
   * @returns {Promise<void>}
   */
  async allow(user, roleNames) {
    const aclRoles = await this.getAclRoles(roleNames);

    aclRoles.forEach((role) => {
      user.roles.push(role.id);
    });

    await user.save();

    this.uw.publish('acl:allow', {
      userID: user.id,
      roles: aclRoles.map((role) => role.id),
    });
  }

  /**
   * @param {User} user
   * @param {string[]} roleNames
   * @returns {Promise<void>}
   */
  async disallow(user, roleNames) {
    const aclRoles = await this.getAclRoles(roleNames);
    /** @type {(roleName: string) => boolean} */
    const shouldRemove = (roleName) => aclRoles.some((remove) => remove.id === roleName);
    user.roles = user.roles.filter((role) => !shouldRemove(getRoleName(role)));
    await user.save();

    this.uw.publish('acl:disallow', {
      userID: user.id,
      roles: aclRoles.map((role) => role.id),
    });
  }

  /**
   * @param {User} user
   * @returns {Promise<string[]>}
   */
  // eslint-disable-next-line class-methods-use-this
  async getAllPermissions(user) {
    const roles = await getAllUserRoles(user);
    return roles.map((role) => role.id);
  }

  /**
   * @param {User} user
   * @param {string} permission
   * @returns {Promise<boolean>}
   */
  async isAllowed(user, permission) {
    const { AclRole } = this.uw.models;

    const role = await AclRole.findById(permission);
    if (!role) {
      return false;
    }

    const userRoles = await getAllUserRoles(user);
    const roleIds = userRoles.map((userRole) => userRole.id);

    debug('role ids', roleIds, 'check', user.id, role.id, 'super', this.superRole);

    return roleIds.includes(role.id) || roleIds.includes(this.superRole);
  }
}

/**
 * @param {import('../Uwave').Boot} uw
 */
async function acl(uw) {
  uw.acl = new Acl(uw);
  uw.httpApi.use('/roles', routes());

  uw.after(async () => {
    await uw.acl.maybeAddDefaultRoles();
  });
}

module.exports = acl;
module.exports.Acl = Acl;
