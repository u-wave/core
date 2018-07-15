# u-wave-web change log

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

## 0.4.0 / 15 Jul 2018

Features:
 * Implement filter parameter for getUsers(). (#220)
 * Move waitlist into core. (#250)

Internal:
 * Rename prepublish npm script to prepare.
 * Dependency updates.

## 0.3.2 / 03 Apr 2018

Bugfixes:

 * Add waitlist.join.locked permission to default moderator role. (#218)

## 0.3.1 / 29 Mar 2018

Bugfixes:

 * Assign "user" role by default. (#214)

## 0.3.0 / 18 Mar 2018

Features:

 * Add optional `user` parameter to media sources. (#133)
 * Use `IORedis#quit` instead of `IORedis#end`. (#139)
 * Implement bans. (#104)
 * Set a default avatar. (#146)
 * Generate cjs and es modules builds. (#166)
 * Accept user object in more playlist methods. (#183)
 * Add `users.findOrCreateSocialUser`. (#187)
 * Remove custom sourceType parameter. (#153)
 * Add login and password change to users plugin. (#200)
 * Publish ACL role changes. (#211)

Bugfixes:

 * Fix adding items to playlist. (#136)
 * Normalize unicode strings before inserting into DB. (#205)
 * Fix `acl.deleteRole`. (#207)
 * Use Redis sets to store votes. (#212)

## 0.2.2 / 09 Jul 2017

Features:

 * Implement locking during booth advances. (#124)

Bugfixes:

 * Skip user plays when their playlist is empty while entering the booth. (#121)

Internal:

 * Use temporary databases instead of mockgoose while running tests. (#123)

## 0.2.1 / 21 Jun 2017

Features:

 * Make email addresses case insensitive. (#112)

Internal:

 * Fix warnings in tests. (#113)
 * Ensure `Promise` always refers to bluebird. (#114)
 * Add Node 8 to Travis. (#115)

## 0.2.0 / 15 Jun 2017

Features:

 * Add option to disable default plugins. (300fc1deab73084fc9aec4852bbe116e00353aa0)
 * Add role-based ACL. (#60)
 * Implement retrieving play history. (#92)
 * Return a `Page` from `getUsers()`. (#87)
 * Show a more useful error message when the User slug is empty. (#101)

Internal:

 * Switch to `bcryptjs` from `bcrypt`. (#97)
 * Switch to `transliteration` from `speakingurl`. (#98)

## 0.1.0 / 30 Dec 2016

Start tracking changes.
