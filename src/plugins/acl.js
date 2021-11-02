'use strict';

const { flatten } = require('lodash');
const debug = require('debug')('uwave:acl');
const defaultRoles = require('../config/defaultRoles');
const routes = require('../routes/acl');

/**
 * @typedef {import('../models').AclRole} AclRole
 * @typedef {import('../models').User} User
 * @typedef {{ roles: AclRole[] }} PopulateRoles
 * @typedef {Omit<AclRole, 'roles'> & PopulateRoles} PopulatedAclRole
 */

/**
 * Not great: I don't think I can statically verify that the roles functions
 * return exclusively populated or unpopulated roles. So I just tell typescript
 * that it could be either. If the ACL module is rewritten to use graph queries
 * to unroll permissions inside mongodb, we probably don't need this anymore.
 * @typedef {AclRole | PopulatedAclRole} MaybePopulatedAclRole
 */

/**
 * @param {AclRole | PopulatedAclRole} role
 * @returns {Promise<MaybePopulatedAclRole[]>}
 */
async function getSubRoles(role) {
  if (role.roles.length === 0) {
    return [role];
  }

  // This function juggles the `.roles` type a bit between strings and AclRole instances,
  // and typescript does not like that!
  if (typeof role.roles[0] === 'string') {
    // @ts-ignore TS2349: this might require a type parameter now? not sure how to put that in.
    await role.populate('roles');
  }

  /** @type {AclRole[]} */
  // @ts-ignore TS2322: we just made sure this is an AclRole and not a string
  const relatedRoles = role.roles;

  const roles = await Promise.all(relatedRoles.map(getSubRoles));
  return [role, ...flatten(roles)];
}

/**
 * @param {User} user
 * @returns {Promise<MaybePopulatedAclRole[]>}
 */
async function getAllUserRoles(user) {
  if (user.roles.length === 0) {
    return [];
  }

  await user.populate('roles');

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

const SUPER_ROLE = '*';

class Acl {
  #uw;

  /**
   * @param {import('../Uwave')} uw
   */
  constructor(uw) {
    this.#uw = uw;
  }

  async maybeAddDefaultRoles() {
    const { AclRole } = this.#uw.models;

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
   * @private
   */
  async getAclRoles(names, options = {}) {
    const { AclRole } = this.#uw.models;

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
   * @returns {Promise<Record<string, string[]>>}
   */
  async getAllRoles() {
    const { AclRole } = this.#uw.models;

    /** @type {AclRole[]} */
    const roles = await AclRole.find().lean();
    return roles.reduce((map, role) => Object.assign(map, {
      [role._id]: role.roles,
    }), {});
  }

  /**
   * @param {string} name
   * @param {string[]} permissions
   */
  async createRole(name, permissions) {
    const { AclRole } = this.#uw.models;

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

  /**
   * @param {string} name
   */
  async deleteRole(name) {
    const { AclRole } = this.#uw.models;

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

    this.#uw.publish('acl:allow', {
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

    this.#uw.publish('acl:disallow', {
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
    const { AclRole } = this.#uw.models;

    const role = await AclRole.findById(permission);
    if (!role) {
      return false;
    }

    const userRoles = await getAllUserRoles(user);
    const roleIds = userRoles.map((userRole) => userRole.id);

    debug('role ids', roleIds, 'check', user.id, role.id, 'super', SUPER_ROLE);

    return roleIds.includes(role.id) || roleIds.includes(SUPER_ROLE);
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
