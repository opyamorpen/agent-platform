# Loop Engineering Rollback Baseline

The formal baseline before loop engineering is immutable:

- Plugin version: `v0.1.30`
- Git commit: `a21339f91de69cc1aef416185cef8d3418cf8d62`
- Git tag: `pre-loop-engineering-v0.1.30`
- Backup branch: `backup/pre-loop-engineering-v0.1.30`
- OPKX: `ones-ai-workflow-v0.1.30.opkx`
- SHA-256: `a62d0b1a73a4168dab926cae2e2b67bf5663089b98bb6790f08153915c9138fd`
- GitHub release: `pre-loop-engineering-v0.1.30`
- Environment: `https://demo-plugin.ones.pro/`
- App ID: `app_onesaiworkflow01`
- Baseline installed state: `v0.1.30 / enabled`

## Rollback Order

1. Disable the team-level loop runtime switch to stop new automatic correction attempts.
2. Disable the loop policy on affected workflow nodes.
3. If a code rollback is required, build a forward rollback package from the baseline runtime code using a version higher than the currently installed `v0.2.x` version.

Do not delete newly declared entities during a forward rollback. Loop data remains stored but must not participate in runtime behavior. Do not overwrite or delete the original baseline OPKX or GitHub release asset.
