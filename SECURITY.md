# Security policy

Please report security issues privately through
[GitHub private vulnerability reporting](https://github.com/levijubb/gistry/security/advisories/new),
not as public issues. You'll get a reply within a few days.

Only the latest release receives fixes.

Every release VSIX is built in GitHub Actions and carries a signed build-provenance attestation. Verify one with:

```sh
gh attestation verify gistry-<version>.vsix --repo levijubb/gistry
```
