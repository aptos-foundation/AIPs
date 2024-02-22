---
aip: 69
title: Start replication of Google JWK on chain
author: Zhoujun Ma (zhoujun@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: <Draft>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Framework)>
created: <02/21/2024>
requires (*optional): 67
---

# AIP-69 - Start replication of Google JWKs on chain

## Summary

This AIP proposes to start the replication of
Google JWKs (available in Google API https://accounts.google.com/.well-known/openid-configuration)
on chain, using the (native JWK consensus framework)[https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md].

## Goals

This will enable Google-based [OIDB accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md).

## Motivations

Google is one of the most popular OIDC providers. Enabling Google-based OIDB accounts can greatly expand Aptos user base.

Besides, some recent observation shows that Google's JWK operation seems to satisfy the requirements of
[JWK consensus]([https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md])
and [OIDB accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md)
quite well.
(NOTE: this is unofficial observation and there is no Google documentation known to confirm with!)
- JWK rotation happens approximately **every week**.
- There are usually 2 JWKs, `(K[i], K[i+1])`.
  - Likely, `K[i+1]` is the new primary JWK, and `K[i]` is kept so signatures before the last rotation can still be verified.
  - It is unclear whether Google starts to sign with `K[i+1]` immediately after the last rotation.
    - If so, due to replication latency (currently ~10 seconds), OIDB transactions signed by `K[i+1]` may be unverifiable in the first ~10 seconds after rotation.
      Anyway, replication latency is unavoidable and is mitigatable with some retry mechanism in SDK/applications.
  - The next rotation updates the JWK set to `(K[i+1], K[i+2])`.

## Impact

Operators need to ensure their nodes have access to the following Google APIs.
- `https://accounts.google.com/.well-known/openid-configuration`
- The `jwk_uri` of the response JSON from the API above.
  - The current value is `https://www.googleapis.com/oauth2/v3/certs`.

## Specification

With (native JWK consensus framework)[https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md] enabled,
this proposal can be done by adding Google into the supported OIDC provider list,
which is an on-chain configuration of the framework.

## Reference Implementation

Here is an example governance script that add Google into the supported OIDC provider list.

```
script {
    use aptos_framework::aptos_governance;
    use aptos_framework::jwks;

    fun main(core_resources: &signer) {
        let core_signer = aptos_governance::get_signer_testnet_only(core_resources, @0x1);
        let framework_signer = &core_signer;

        jwks::upsert_oidc_provider(
            &framework_signer,
            b"https://accounts.google.com",
            b"https://accounts.google.com/.well-known/openid-configuration"
        );

        aptos_governance::reconfigure(framework_signer);
    }
}
```

## Testing (Optional)

Test have been done on a localnet and will also be done in a previewnet (a more realistic environment hosted by Aptos Labs,
see [here](https://aptoslabs.medium.com/previewnet-ensuring-scalability-and-reliability-of-the-aptos-network-48f0d210e8fe)) for an example).

## Timeline

### Suggested implementation timeline

N/A, as this is an on-chain configuration change.

### Suggested developer platform support timeline

N/A, as this is an on-chain configuration change.

### Suggested deployment timeline

Release 1.10

## Security Considerations



Also see [here](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md#security-and-liveness-considerations)
for the security considerations of the JWK consensus framework in general.

Also see [here](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#security-liveness-and-privacy-considerations)
for the security considerations of OIDB accounts in general.
