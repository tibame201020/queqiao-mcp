# Releasing queqiao-mcp

## Normal release path

After the npm package has been bootstrapped and the GitHub trusted publisher is configured, releases are tag-driven:

1. merge a release-ready version to `main`;
2. require green CI, including the pinned Queqiao compatibility acceptance;
3. create and push immutable tag `v<package-version>`;
4. publish the matching GitHub Release;
5. `.github/workflows/publish-npm.yml` verifies tag/package identity, reruns package gates, and publishes to npm through GitHub OIDC with provenance.

The workflow checks the registry first and exits successfully when the exact version already exists. This makes the initial bootstrap release safe to record in GitHub without attempting a duplicate publish.

## First-package bootstrap

npm trusted-publisher configuration requires the package to already exist in the npm registry. Therefore the first `queqiao-mcp` version must be created once using an npm account with the required 2FA/authentication. Do not commit or share OTPs, npm session tokens, or automation tokens.

After the first package exists, configure the GitHub trusted publisher for repository `tibame201020/queqiao-mcp` and workflow `publish-npm.yml`. Subsequent versions must use the GitHub Release workflow instead of local `npm publish`.

## Immutable release identity

Never move an already-pushed release tag to add or change release automation. Workflow evolution belongs on the default branch; package source remains the commit identified by the release tag.
