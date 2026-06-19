// Enforces the commit convention documented in the README:
// Conventional Commits, imperative + capitalized subject, <= 50 chars.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The article we follow capitalizes the description, so relax the default
    // lower-case-only subject rule (still forbid the empty case).
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 50],
    'body-max-line-length': [2, 'always', 72],
  },
};
