---
aip: 90
title: Add Apple as a supported OIDC provider
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/452
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: 06/14/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md 
---

# AIP-90 - Add Apple as a supported OIDC provider

## Summary

We are proposing adding Apple as a supported OIDC provider for Aptos Keyless accounts.
This would allow users to "Sign in with Apple" inside dapps and/or wallets.
This change requires Aptos validators to periodically refresh their views of Apple's JWKs[^jwks] via JWK consensus[^aip-67].
It is worth emphasizing Apple's OIDC implementation is privacy-preserving, and, as a result, prevents the mechanism for recovering Apple-based keyless accounts associated with disappeared dapps and/or wallets[^aip-61-recovery] (see ["Impact"](#impact)).

## Impact and risks

Apple's OIDC implementation is more privacy-preserving than Google's.
Specifically, when the same Apple user signs in into two different applications, each application sees a different, application-specific `sub` identifier for the user.
As a result, colluding applications cannot tell if they are authenticating the same user or not.
In the OIDC standard, this privacy-preserving technique is referred to as _pairwise-pseudonymous identifiers (PPID)_[^ppid].

**Note:** Even if the application asks for the `email` field to be included, the Apple user can enable the "Hide my email" option when signing in, which results in an application-specific `email` field as well.

As a result of this, the approach for dealing with disappearing dapps for Apple keyless users described in AIP-61[^aip-61-recovery] does not apply, since it assumes different applications see the same `sub` for the same Apple user.
This puts onus on either users or applications to guarantee recovery via some other mechanism (e.g., `t`-out-of-`n` accounts, passkeys[^passkeys]).

## Alternative solutions

There are no alternatives beyond continuing to rely on [Google as the only supported OIDC provider](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-69.md).

The decision is binary: Do we (not) want to support keyless accounts backed by Apple accounts?

## Specification and Implementation Details

This AIP's implementation is very simple: we submit a governance proposal to enable Apple support, described below.

If the proposal is accepted, the validators will start [JWK consensus](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md) to maintain a fresh view of Apple's JWKs.
As a result, keyless accounts which are backed by Apple can now transact on chain.

## Reference Implementation

The governance proposal that will be submitted is:

```rust
script {
    use aptos_framework::aptos_governance;
    use aptos_framework::jwks;

    fun main(core_resources: &signer) {
        let core_signer = aptos_governance::get_signer_testnet_only(core_resources, @0x1);
        let framework_signer = &core_signer;

        jwks::upsert_oidc_provider(
            framework_signer,
            b"https://appleid.apple.com",
            b"https://appleid.apple.com/.well-known/openid-configuration"
        );

        aptos_governance::reconfigure(framework_signer);
    }
}
```

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

To be discussed more. For now:

1. Make sure JWK consensus correctly handles Apple via smoke tests.
2. Do a manual end-to-end test in devnet for an Apple keyless account.

## Security Considerations

There should be no code changes, beyond some tests.

Nonetheless, as is the case for any keyless account, the security of that account = the security of its OIDC provider. Currently, all keyless accounts rely on Google, so this AIP would give users the option to rely on Apple for their account's security.

An argument could be made that this strengthens the liveness/durability of keyless accounts if they are set up as a 1-out-of-2 account with Google and Apple.

## Future Potential

This will allow onboarding more users into the Aptos blockchain via keyless accounts[^aip-61].

## Timeline

### Suggested implementation timeline

N/A, as this is an on-chain configuration change.

### Suggested developer platform support timeline

N/A, as this is an on-chain configuration change.

The SDK already handles additional OIDC providers.

### Suggested deployment timeline

As soon as possible. To be discussed and agreed upon.

## Open Questions (Optional)

**Key question:** What would be a user-friendly recovery mechanism[^aip-61-recovery] for OIDC providers like Apple that have PPIDs?

## References

[^aip-61]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md
[^aip-67]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md
[^aip-61-recovery]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#recovery-service
[^jwks]: https://appleid.apple.com/.well-known/openid-configuration
[^passkeys]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-66.md
[^ppid]: https://openid.net/specs/openid-connect-core-1_0.html#Terminology
