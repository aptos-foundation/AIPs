---
aip: 96
title: Federated Keyless accounts
author: Alin Tomescu (alin@aptoslabs.com), davidiw, heliuchuan
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/490
Status: Draft  #| Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Framework)>
created: 08/21/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): [AIP-61](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md), [AIP-75](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-75.md), [AIP-81](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-81.md)
---

# AIP-96 - Federated Keyless accounts

## Summary

 > Summarize in 3-5 sentences.
 > Define the problem we're solving.
 > How does this document propose solving it.
 > What are the goals and what is in scope? Any metrics?

This AIP seeks to extend the **keyless account** architecture[^aip-61] to support more **OpenID Connect (OIDC) providers**, beyond the ones that are allow-listed in `0x1::jwks` via JWK consensus[^aip-67], while maintaining its *decentralization*.

This is important for two reasons. First, many dapp developers prefer implementing OIDC flows using **identity access management (IAM)** products such Auth0[^auth0], AWS Cognito[^aws-cognito], or Okta[^okta], which currently cannot be supported in the keyless architecture in an *efficient* and *decentralized* manner. Second, dapp developers want more freedom of picking their own OIDC providers to implement custom authentication flows based on passwords, emails or SMS.

The high-level approach is to introduce a new **federated keyless account** type whose [public key](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#public-keys) additionally contains an Aptos account address where the OIDC provider’s JWKs are to be found. We call this the **JWK address**. In other words, a federated keyless account address contains a pointer to the JWKs that are to be used to validate its [keyless signatures](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#zero-knowledge-signatures).

### Out of Scope

 > What are we committing to not doing and why are they scoped out?

This AIP is not concerned with securing the publication of the JWKs at the JWK address. Instead, it leaves it up to the dapp developer to either (1) secure it themselves, e.g., via a paid oracle, or (2) rely on a trusted entity to secure it. Nonetheless, we discuss how such JWK publication risks can be [well-mitigated against](#JWK-publishing-risk-mitigation) later on.

This AIP does not propose any changes to JWK consensus[^aip-67]or the keyless ZK relation and its associated `circom` circuit implementation[^aip-61].

## High-level Overview

 > Define the strawman solution with enough details to make it clear why this is the preferred solution.
 > Please write a 2-3 paragraph high-level overview here and defer writing a more detailed description in [the specification section](#specification-and-implementation-details).

Currently, a [keyless account’s public key](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#public-keys) contains:

- the identity of the OIDC provider (`iss`)
- a commitment, using a *pepper* as a blinding factor, to:
  - the identity of the user (`sub`)
  - the identity of the application (`aud`)

Normally, when verifying keyless TXN signatures for such an account, the validators use the `iss` to look up the OIDC provider’s JWKs in the `0x1::jwks::PatchedJWKs` resource, which acts as the **single source of truth** for an `iss`’s JWKs.

This AIP will allow for **federated keyless accounts** to rely on a **secondary source of ground truth** on their JWKs.

How? By introducing a new **federated keyless account** type, whose **federated public key** contains:

- a **JWK** address where the OIDC provider’s JWKs are to be found (`jwk_addr`)
- a traditional keyless public key (as detailed above).

For this new type of account, **if** the `iss`'s JWK is **not** found in `0x1::jwks::PatchedJWKs`, then the validation logic will look for the JWKs in a new `0x1::jwks::FederatedJWKs` resource stored at the `jwk_addr` indicated in the account’s federated public key.

This gives developers freedom to use any OIDC provider (`iss`) they want, as long as they adopt the responsibility of publishing the provider’s JWKs at a JWK address that the developer controls. Alternatively, developers can choose to rely on an existing JWK address which is updated by a trusted **JWK publisher**. This allows for separation between the *developer role* and the *JWK publisher role*: they need not be adopted by the same person/organization/entity.

As an example, a secure way of publishing JWKs would rely on a trustworthy HTTPS oracle. A less secure way would rely on the developer to publish (we discuss [mitigating attacks](#JWK-publishing-risk-mitigation) later).

Lastly, the prover[^aip-75] and pepper[^aip-81] services need to be updated to dynamically fetch JWKs for this new dynamic set of OIDC providers, upon seeing a JWT for an allow-listed `iss` regex (e.g., Auth0 `iss`'s).

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?
 > What might occur if we do not accept this proposal?
 > List out other AIPs this AIP is dependent on
...

1. **Application developers** are impacted, since they now need to consider this new federated keyless account type when implementing keyless accounts into their dapp/wallet. They need to understand that this is **opt-in** and only necessary if the developers wants an OIDC provider that is not likely to be supported in `0x1::jwks` such as Auth0 (see [why below](#alternative-solutions)).
2. **Dapp/wallet users** are impacted, since their account security could, in the worst case, be as good as the JWK publisher’s security (see [mitigations](#JWK-publishing-risk-mitigation)).

## Alternative solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

In an alternative approach, any dapp would submit their preferred OIDC provider `iss` and its OpenID configuration URL (`config_url`) to Aptos governance via `0x1::jwks::upsert_oidc_provider_for_next_epoch`. If approved, then that provider’s JWKs would be automatically published and updated via JWK consensus[^aip-67]. Then, the developer could create (traditional) keyless accounts[^aip-61] for users of that OIDC provider.

Unfortunately, for IAMs like Auth0 and AWS Cognito, the `config_url` is **tenant-specific**: it is specific to the dapp developer (e.g., `https://{dappDomain}/.well-known/openid-configuration`; see [appendix](#example-of-auth0-oidc-configuration)). This would mean **each** dapp developer would need to go through governance with their **tenant-specific** `config_url` before they can use their preferred OIDC provider. Furthermore, it could eventually overwhelm JWK consensus[^aip-67], since there will be as many OIDC providers as there are dapps.

**Pros:**

- An immediate solution that works out of the box, without any implementation work.
- The tenant-specific JWKs could, in theory, be (re)moved eventually via governance.
- No one is trusted for correct JWK publishing; delegated to JWK consensus[^aip-67].

**Cons:**

- Restricts development pace to governance pace.
- Existing JWK consensus infrastructure will likely not support more than 4,000 JWKs (so $\le$ 2,000 dapps).
- Most dapps will not have enough stake to be able to propose their OIDC provider to Aptos governance.
- It puts onus on Aptos governance to decide which dapps should be allowed to use keyless with their favorite OIDC provider.
  - e.g., need to be able to clearly identify a “legitimate” OIDC provider / dapp, or risk adding too many to JWK consensus and potentially DoS
  - e.g., when seeing two proposals for the same Auth0 OIDC with different tenants (i.e., dapps), what would be a fair process to decide between the two?

## Specification and Implementation Details

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

At a *high*-level, the [overview above](#high-level-overview) explains the main idea: create a new federated keyless account type that points to a secondary source of truth for the JWKs of its OIDC provider. At a *lower* level, the [reference implementation section below](#reference-implementation) discusses the new Rust structs, Move structs and Move functions that are needed to enable this functionality.

Some noteworthy implementation details are:

1. The new federated keyless account feature is gated via a `FEDERATED_KEYLESS` feature flag: transactions for such accounts are dropped until this feature is enabled.

2. Most of the validation logic changes are in `validate_authenticators` in `aptos-vm/src/keyless_validation.rs` ([here](https://github.com/aptos-labs/aptos-core/blob/bd5a634acb4dd452fdee1a2852c6f1b5222158e2/aptos-move/aptos-vm/src/keyless_validation.rs#L151)). 

3. In our implementation, it is helpful to abstract away a keyless public key as either traditional or federated via an enum:

   ```rust
   #[derive(Clone, Debug, Eq, PartialEq, Hash)]
   pub enum AnyKeylessPublicKey {
       Normal(KeylessPublicKey),
       Federated(FederatedKeylessPublicKey),
   }
   ```

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.
 > What is the feature flag(s)? If there is no feature flag, how will this be enabled?

The Aptos validation logic for federated keyless accounts has been implemented in [this PR](https://github.com/aptos-labs/aptos-core/pull/14127).

To support a new federated keyless account, we create a new type of keyless PK called `FederatedKeylessPublicKey` and add it to `AnyPublicKey`:

```rust
/// Unlike a normal keyless account, a "federated" keyless account will accept JWKs published at a
/// specific contract address.
#[derive(Clone, Debug, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub struct FederatedKeylessPublicKey {
    pub jwk_addr: AccountAddress,
    pub pk: KeylessPublicKey,
}

#[derive(Clone, Debug, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub enum AnyPublicKey {
    Ed25519 {
        public_key: Ed25519PublicKey,
    },
    Secp256k1Ecdsa {
        public_key: secp256k1_ecdsa::PublicKey,
    },
    Secp256r1Ecdsa {
        public_key: secp256r1_ecdsa::PublicKey,
    },
    Keyless {
        public_key: KeylessPublicKey,
    },
    FederatedKeyless {
        public_key: FederatedKeylessPublicKey,
    },
}
```

Dapp developers can manage their JWKs by installing them at their JWK address via a newly-exposed `patch_federated_jwks` function in `0x1::jwks`:

```rust
/// JWKs for federated keyless accounts are stored in this resource.
struct FederatedJWKs has drop, key {
    jwks: AllProvidersJWKs,
}

/// Called by a federated keyless dapp owner to install the JWKs for the federated OIDC provider (e.g., Auth0, AWS
/// Cognito, etc).
///
/// For type-safety, we explicitly use a `struct FederatedJWKs { jwks: AllProviderJWKs }` instead of
/// reusing `PatchedJWKs { jwks: AllProviderJWKs }`, which is a JWK-consensus-specific struct.
public fun patch_federated_jwks(jwk_owner: &signer, patches: vector<Patch>) acquires FederatedJWKs {
    // Prevents accidental calls in 0x1::jwks that install federated JWKs at the Aptos framework address.
    assert!(!system_addresses::is_aptos_framework_address(signer::address_of(jwk_owner)),
        error::invalid_argument(EINSTALL_FEDERATED_JWKS_AT_APTOS_FRAMEWORK)
    );

    let jwk_addr = signer::address_of(jwk_owner);
    if (!exists<FederatedJWKs>(jwk_addr)) {
        move_to(jwk_owner, FederatedJWKs { jwks: AllProvidersJWKs { entries: vector[] } });
    };

    let fed_jwks = borrow_global_mut<FederatedJWKs>(jwk_addr);
    vector::for_each_ref(&patches, |obj|{
        let patch: &Patch = obj;
        apply_patch(&mut fed_jwks.jwks, *patch);
    });

    let num_bytes = vector::length(&bcs::to_bytes(fed_jwks));
    assert!(num_bytes < MAX_FEDERATED_JWKS_SIZE_BYTES, error::invalid_argument(EFEDERATED_JWKS_TOO_LARGE));
}
```

## Testing

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out. Some examples include user stories, network health metrics, system metrics, E2E tests, unit tests, etc) 
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

We will want to test that (1) valid TXNs validate and (2) invalid ones do not. We will also want to test that `0x1::jwks::PatchedJWKs` correctly overrides the JWKs that are in `jwk_addr::FederatedJWKs`, if any.

Currently, we have tested the following (but have not merged PRs yet):

1. `e2e-move-test` basic viability test of a federated keyless account TXN passing validation against the JWKs at `<jwk_addr>::FederatedJWKs` for ground truth.
2. Also, tested that if `0x1::jwks::PatchedJWKs` has the wrong JWK for the `iss`, it overrides the JWKs at `<jwk_addr>::FederatedJWKs` and fails the TXN (as it should)
3. Smoke test of a federated keyless TXN succeeding

First, we will merge all of these tests in via a different PR.

Second, we will write additional tests for:

1. A TXN failing validation if there is no JWK installed anywhere.
2. The `0x1::jwks::PatchedJWKs` being used as an override to successfully validate a TXN when `<jwk_addr>::FederatedJWKs` has a mismatching JWK.
   1. Additionally, test that the TXN fails validation when there are no JWKs at `0x1` and it must rely on `<jwk_addr>::FederatedJWKs` which has the wrong JWKs.

## Risks and Drawbacks

 > - Express here the potential risks of taking on this proposal. What are the hazards? What can go wrong?
 > - Can this proposal impact backward compabitibility?
 > - What is the mitigation plan for each risk or drawback?

There should not be any backward compatibility issues.

One risk is performance degradation on the Aptos validators and/or full node network due to the extra state DB read for the `FederatedJWKs` at `jwk_addr` during federated keyless TXN validation. To mitigate against this, the size of such resources has been set to 2KiB initially.

## Security Considerations

 > - How can this AIP potentially impact the security of the network and its users? How is this impact mitigated?
 > - Are there specific parts of the code that could introduce a security issue if not implemented properly?
 > - Link tests (e.g. unit, end-to-end, property, fuzz) in the reference implementation that validate both expected and unexpected behavior of this proposal
 > - Include any security-relevant documentation related to this proposal (e.g. protocols or cryptography specifications)

With any change that introduces a new account type, there are two kinds of security issues to be aware of:

1. Risk of users being locked out of their accounts
2. Risk of user accounts being stolen

### ZK circuit incompatibilities

> [!NOTE]
>
> This security consideration applies to any approach that proposes relaxing the requirements on the OIDC providers for keyless, not just to the design proposed in this AIP.

The `circom` implementation of the [keyless relation](#the-keyless-zk-relation-mathcalr) has been thoroughly tested with the supported OIDC providers in `0x1::jwks`. As a result, custom OIDC providers used in federated keyless accounts might not be fully supported. This could, in some cases, lock users out of their accounts.

There are several mechanisms to mitigate against this:

1. Test the ZK circuit on the JWTs of IAMs like Auth0, AWS Cognito and Okta and build up a list of supported **federated** OIDC providers.
2. Encourage developers to use the default prover and pepper service in the Aptos SDK, which will allow-list these supported **federated** OIDC providers, thereby preventing developers from using an unsupported one early on.
3. In case of emergency, enable the [leaky mode](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#warm-up-leaky-signatures-that-reveal-the-users-and-apps-identity), which restores access to the federated keyless account by circumventing the ZK circuit, albeit at the cost of leaking the account’s user (`sub`) and application (`aud`) identity.

### Liveness and security of OIDC provider

> [!NOTE]
>
> This security consideration applies to any approach that proposes relaxing the requirements on the OIDC providers for keyless, not just to the design proposed in this AIP.

This AIP, in essence, is relaxing the requirements on keyless OIDC providers by allowing devs to specify where JWKs are to be found for a keyless account within that account’s address (i.e., `FederatedKeylessPublicKey`).

As a result, a natural security concern arises: dapp developers could unknowingly rely on untrustworthy OIDC providers who are either not online or are compromised.

If an OIDC provider is not online, then users will not be able to obtain signed JWTs and may be locked out of their federated keyless accounts (e.g., if their ZKP[^aip-61] has expired or if they lost their ESK[^aip-61]). Mitigating against this in a decentralized manner is difficult.

If an OIDC provider is compromised and its secret keys are stolen, then users’ accounts could be stolen. Mitigating against this in traditional keyless can be done via an emergency governance proposal that removes the provider’s compromised JWK. This mitigation assumes that social consensus on the compromised state of the provider is possible. However, in the federated setting, it may be much harder to reach such social consensus due to the potentially-unbounded set of OIDC providers or due to their tenant-specific nature.

Furthermore, revocation of federated JWKs is currently not implemented, but could be via a new `0x1::jwks::revoke_federated_jwks(fx: &signer, jwk_addr: address, jwk: RSA_JWK)` function in Move.

### IAM risks

>  [!NOTE]
>
> This security consideration applies to any approach that proposes supporting IAM-based OIDC providers such as Auth0 for keyless, not just to the design proposed in this AIP.

When using IAMs such as Auth0 or AWS Cognito, the IAM may allow the developer to impersonate its users, which would create account theft risks as discussed above. More research on IAMs and their properties is needed in order to provide a recommendation here.

### Malicious or compromised JWK publisher

>  [!WARNING]
>
> This security consideration **only** applies to the design in this AIP, which relies on a trusted JWK publisher. Fortunately, easy mitigations are possible.

Since dapp developers can act as their own JWK publishers, they can in effect easily impersonate any user on their app. Such impersonation may occur due to maliciousness or incompetence. For example, the secret key that is used to manage the `jwk_addr` is compromised.

Regarding maliciousness, even a traditional keyless dapp turned malicious can steal its user’s credentials or generate new ones upon a sign in request. So, much like a wallet application, a keyless dapp is already trusted, to some extent, to not be malicious. 

The difference is that a malicious federated keyless dapp developer who also acts as the JWK publisher could more easily steal its users credentials or generate new ones, since it can replace the JWKs with malicious ones and does not need any victim user cooperation.

To mitigate against account theft via such malicious JWKs, we propose using the ZK proving service and pepper service as a layer of defense. Specifically, these services can easily look up the correct JWKs (via the `config_url`) upon a ZKP or pepper request and not respond if the JWT is not signed under the correct JWK. This will thwart the attack since without a ZKP (or without a pepper), the attacker cannot access the account.

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

This proposal should serve to expand:

1. The set of dapps that use keyless, since webapp developers have a preference towards using IAMs like Auth0 which are currently not supported by keyless
2. The set of “keyless” authentication methods (e.g., email, password, SMS), by expanding the set of supported OIDC providers

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

The implementation is in progress:

- the Aptos validator Rust code & the Aptos Move framework code are done (in [this PR](https://github.com/aptos-labs/aptos-core/pull/14127))
- the SDK needs to be updated
- the pepper and prover services need to be updated to fetch JWKs for allow-listed `iss` regexes (e.g., Auth0)

### Suggested developer platform support timeline

 > Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

- We plan to implement SDK support for this feature, to allow dapp developers to easily create & access a federated keyless account.
- Indexer team will do a small [processor](https://github.com/aptos-labs/aptos-indexer-processors) update to handle the new `FederatedKeylessPublicKey` enum variant added to `AnyPublicKey`.

### Suggested deployment timeline

 > Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

This will be part of the v1.19 release. Will be enabled on devnet initially. Then, testnet and finally mainnet upon further testing.


## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

**Q1:** Should the initial set of OIDC providers supported for federated keyless accounts be restricted via allow-listing on the training-wheels-enabled prover service? This would allow limiting account loss risk due to [ZK circuit incompatibilities](#zk-circuit-incompatibilities) and due to [untrustworthy OIDC providers](#Liveness-and-security-of-OIDC-provider).

**Q2:** How to deal with any possible [IAM impersonation risks](#iam-risks)?

## References

[^aip-61]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md
[^aip-67]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md
[^auth0]:https://auth0.com/docs/api
[^aws-cognito]:https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-reference.html
[^okta]:https://developer.okta.com/docs/reference/okta  ↩

## Appendix

### Example of Auth0 OIDC configuration

This is an excerpt from Auth0’s docs [here](https://auth0.com/docs/get-started/applications/configure-applications-with-oidc-discovery). As explained there, the OIDC configuration URL is specific to the dapp: `https://{yourDomain}/.well-known/openid-configuration` and this yields a dapp-specific JWK endpoint URL, which JWK consensus[^aip-67] was not designed to support.

The configuration fetched from the OIDC configuration URL will look like:

```
{
  "issuer": "https://{yourDomain}.us.auth0.com/",
  "authorization_endpoint": "https://{yourDomain}.us.auth0.com/authorize",
  "token_endpoint": "https://{yourDomain}.us.auth0.com/oauth/token",
  "device_authorization_endpoint": "https://{yourDomain}.us.auth0.com/oauth/device/code",
  "userinfo_endpoint": "https://{yourDomain}.us.auth0.com/userinfo",
  "mfa_challenge_endpoint": "https://{yourDomain}.us.auth0.com/mfa/challenge",
  "jwks_uri": "https://{yourDomain}.us.auth0.com/.well-known/jwks.json",
  "registration_endpoint": "https://{yourDomain}.us.auth0.com/oidc/register",
  "revocation_endpoint": "https://{yourDomain}.us.auth0.com/oauth/revoke",
  "scopes_supported": [
    "openid",
    "profile",
    "offline_access",
    "name",
    "given_name",
    "family_name",
    "nickname",
    "email",
    "email_verified",
    "picture",
    "created_at",
    "identities",
    "phone",
    "address"
  ],
  "response_types_supported": [
    "code",
    "token",
    "id_token",
    "code token",
    "code id_token",
    "token id_token",
    "code token id_token"
  ],
  "code_challenge_methods_supported": [
    "S256",
    "plain"
  ],
  "response_modes_supported": [
    "query",
    "fragment",
    "form_post"
  ],
  "subject_types_supported": [
    "public"
  ],
  "id_token_signing_alg_values_supported": [
    "HS256",
    "RS256",
    "PS256"
  ],
  "token_endpoint_auth_methods_supported": [
    "client_secret_basic",
    "client_secret_post",
    "private_key_jwt"
  ],
  "claims_supported": [
    "aud",
    "auth_time",
    "created_at",
    "email",
    "email_verified",
    "exp",
    "family_name",
    "given_name",
    "iat",
    "identities",
    "iss",
    "name",
    "nickname",
    "phone_number",
    "picture",
    "sub"
  ],
  "request_uri_parameter_supported": false,
  "request_parameter_supported": false,
  "token_endpoint_auth_signing_alg_values_supported": [
    "RS256",
    "RS384",
    "PS256"
  ]
}
```

