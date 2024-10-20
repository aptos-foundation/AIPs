---
aip: 10X
title: Add Firebase as a supported OIDC provider
author: Oliver He (oliver.he@aptoslabs.com)
Status: Draft # | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: 10/20/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md 
---

# AIP-90 - Add Firebase as a supported OIDC provider

## Summary

We are proposing adding Firebase as a supported OIDC provider for Aptos Keyless accounts.
This would allow the instantiation of Keyless accounts using Firebase JWT credentials.
This change requires Aptos validators to periodically refresh their views of Firebase's JWKs[^jwks] via JWK consensus[^aip-67].
JWTs used to authenticate into Firebase apps are signed by the same set of keys across all Firebase applications.  Thus it makes sense to integrate the key set via JWK consensus.  Google uses the securetoken@system.gserviceaccount.com service account as the signer.

The UWL of the well-known OpenId configuration is - https://securetoken.google.com/google/.well-known/openid-configuration

## Impact and risks

- In Firebase the `iss` and `aud` values are the same.  Since `iss` is public `aud` will be exposed.
- Firebase allows for full custumizable authentication by the project developer.  This allows the developer to generate JWTs for users (scoped to their project via the `iss`) at will.
- Since all Firebase apps use a common keyset, we are able to utilize JWK consensus as there are no scaling issues if the number of apps using Firebase grows larger, since the number of JWKS to register stays the same.  
- Due to the above, we can utilize standard Keyless Accounts (non-Federated) but these accounts encounter have the same risks and considerations as Federated Keyless Accounts from a trust perspective.  However loss of access due to mismanagement of the JWK owner account is no longer an issue.
- The well known configuration address is only assumed to be stable.  It will exist so long as there exists a Firebase project ID with the value 'Google'.  This is not publicized anywhere and its unclear of guarantees of its availability.  All Firebase apps have a well known discovery endpoint at `https://securetoken.google.com/<projectId>/.well-known/openid-configuration` which point to the same JWKS endpoint.  However rather than using a well known configuration for an Aptos project, it makes more sense to use a project ID owned by Google.  If the owner were to delete the project, then the well known endpoint would also disappearing stalling further updates to the JWK set.

## Alternative solutions

The alternative is to support these accounts via [Federated Keyless](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-96.md).  
This comes with drawbacks as now every Keyless integration with Firebase needs to manage an account to update the JWK set.  This also introduces another point of variance when it comes to address derivation and it is needed to remember the address of the account chosen by the dApp developer to get the correct address.  Given that the JWKs update across all Firebase based Federated Keyless Accounts, it makes more sense to leverage JWK consensus[^aip-67].

## Specification and Implementation Details

This AIP's implementation has two parts -

First, we submit a governance proposal to enable Firebase the registration of the JWK set associated with the securetoken@system.gserviceaccount.com service account via JWK consensus.

If the proposal is accepted, the validators will start JWK consensus[^aip-67] to maintain a fresh view of Firebase's JWKs.

Secondly, the authenticator will be updated for Keyless accounts instantiated from a Firebase JWT to use the JWKs view fetched from consensus.  This involves checking the `iss` of the KeylessPublicKey is of the form `https://securetoken.google.com/<projectId>`. If it matches, instead of looking up the JWK by the `iss` in the KeylessPublicKey, just fetch the appropriate JWK from the JWK set mapped to `https://securetoken.google.com/google` in `0x1::jwks::PatchedJWKs` and use that for validation.

Additional changes will be required to allow for support in the SDK, Prover[^aip-75] and Pepper[^aip-81] services.

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
            b"https://securetoken.google.com/google",
            b"https://securetoken.google.com/google/.well-known/openid-configuration"
        );

        aptos_governance::reconfigure(framework_signer);
    }
}
```

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.


1. Make sure JWK consensus correctly handles the Firebase JWKS via smoke tests.
2. Do a manual end-to-end test in devnet for a Firebase keyless account.

## Security Considerations

There should be no code changes, beyond some tests.

It is vital that only KeylessPublicKeys that are for Firebase get remapped to the consensus JWK set for Firebase.

Google secures these JWKs so the risk of theft of the RSA keypair is the same for that of Keyless for Google proper.

Devs have the ability to forge JWTs as Firebase will generate the token for them so long as they have the proper permissions.

In that sense, these Keyless accounts will not be considered as completely self-custodial.

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

[^aip-61]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md
[^aip-67]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md
[^aip-75]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-75.md
[^aip-81]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-81.md
[^aip-61-recovery]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#recovery-service
[^jwks]: https://appleid.apple.com/.well-known/openid-configuration
[^passkeys]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-66.md
[^ppid]: https://openid.net/specs/openid-connect-core-1_0.html#Terminology
