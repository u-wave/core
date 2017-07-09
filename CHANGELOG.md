# 0.2.2 / 09 Jul 2017

Features:

 * Implement locking during booth advances. (#124)

Bugfixes:

 * Skip user plays when their playlist is empty while entering the booth. (#121)

Internal:

 * Use temporary databases instead of mockgoose while running tests. (#123)

# 0.2.1 / 21 Jun 2017

Features:

 * Make email addresses case insensitive. (#112)

Internal:

 * Fix warnings in tests. (#113)
 * Ensure `Promise` always refers to bluebird. (#114)
 * Add Node 8 to Travis. (#115)

# 0.2.0 / 15 Jun 2017

Features:

 * Add option to disable default plugins. (300fc1deab73084fc9aec4852bbe116e00353aa0)
 * Add role-based ACL. (#60)
 * Implement retrieving play history. (#92)
 * Return a `Page` from `getUsers()`. (#87)
 * Show a more useful error message when the User slug is empty. (#101)

Internal:

 * Switch to `bcryptjs` from `bcrypt`. (#97)
 * Switch to `transliteration` from `speakingurl`. (#98)

# 0.1.0 / 30 Dec 2016

Start tracking changes.
