---
aip: 67
title: Native Consensus for JSON Web Key (JWK)
author: Zhoujun Ma (zhoujun@aptoslabs.com)
Status: Draft
type: <Standard (Core, Networking, Framework)>
created: <02/10/2024>
---

# AIP-67 - Native Consensus for JSON Web Key (JWK)
  
## Summary

OpenID Connect (OIDC) orchestrates authentication by enabling a user to prove their identity to a client application, through the mediation of a trusted identity provider, leveraging the OAuth 2.0 framework for secure interactions.
Typically, this process involves verifying a signature of the provider with its cryptographic public keys, which are published in format of **JSON Web Key (JWK)**. For security purpose, JWKs are rotated periodically, but providers may each have its own rotation schedule, and providers typically do not provide official documentation or notification: client apps are expected to fetch JWKs in an ad-hoc manner.

[AIP-61: OIDB accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md) introduced a new type of Aptos accounts that are secured through the owner’s existing OIDC accounts (i.e., their Web2 account with an OIDC provider such as Google, GitHub or Apple), and verifying a transaction from such an OIDC account involves verifying a signature of the provider with its JWK. This requires that validators **agree on the latest JWKs** of every provider that needs to supported.

This AIP proposes a solution where validators:
- monitor the OIDC providers' JWKs by directly fetching them;
- once a JWK change is detected, collaborate with peers to form a quorum-certified JWK update;
- publish the update on-chain through a [validator transaction](https://github.com/aptos-foundation/AIPs/pull/274/files).

### Goals

- Functional: for every provider in a given provider set (probably in an on-chain resource), ensure validators agree on its latest JWKs (and probably publish it as another on-chain resource).
- Non-functional:
    - Security and decentralization: the JWKs should be agreed on by the validator network in a secure and decentralized way, ideally introduce zero extra security assumptions.
    - Low replication latency: once a provider rotates its JWKs, the blockchain should pick them up as soon as possible to be able to process OIDB-based transactions signed by the new key (i.e., ensure liveness after OIDB accounts are enabled).
    - Provider-independence: extra operation required on an OIDC provider's end should be minimized (ideally zero), so new OIDC providers can be supported at a very low cost.
    - DevOps complexity: solutions with lower development & operation complexity is considered cheaper and less risky.

## Motivation

As explained in the summary, [AIP-61: OIDB accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md) re quires validators agree on the latest JWKs of the OIDC providers.
This AIP proposes a solution of the functional goal that balances all non-functional needs:
- the OIDC provider set is assumed to be maintained in an on-chain resource;
- validators take the OIDC provider set as an input and for each provider, monitor and publish the quorum-certified JWK updates on chain;
- relatively small and practical security assumptions on the node environment are introduced;
- replication latency of a few seconds can be achieved;
- there is no requirement on the OIDC provider (other than they are OIDC-compliant);
- DevOps complexity is relatively low.

## Impact

Validator operators need to ensure their validator nodes live in a environment that allow the nodes to securely access OIDC providers' APIs.

This configuration needs to happen every time we update the supported OIDC provider list or any of their OpenID configuration URL.
But hopefully each operation should be trivial.

## Alternative solutions

### Alternative 1: use separate JWK oracle(s)
One alternative is to run a separate trusted oracle to watch JWKs
(or a seprate trusted oracle network to watch JWks and quorum-certify updates)
and publish updates on chain through regular Aptos transactions.

Reasons to not consider: security and decentralization + DevOps complexity.
This solution introduces a new type of node/network that needs to be trusted by the validator network,
which are extra security assumptions and operation complexity.

### Alternative 2: monitor JWK off-chain and publish using governance proposals
Another alternative:
once a JWK update is detected off-chain in any way,
publish using a governance proposal and wait to be voted by the majority of the stake.

Reasons to not consider: latency.
The voting can last up to 7 days (by the current setting),
which means the new JWKs may not be available on chain until they are 7 days old,
which further means the OIDB-associated transactions signed by the new key won't be accepted for 7 days.

### Alternative 3: let OIDC provider update JWKs on chain
One alternative is to have OIDC providers each create their own Aptos account
and publish their new keys on-chain whenever they publish them at its own JWK URL.

Reasons to not consider: security + provider-independence.
This alternative requires that OIDC providers are sufficiently incentivized to participate in Aptos protocol,
which is not the case today and it is unclear how to ensure that.
Even if the providers are incentivized, any of their Aptos account keys/JWKs effectively become a new "single point of compromise" for the whole system: if compromised, all associated OIDB accounts are compromised.
This is some new (and likely undesired) security assumption to make.
Additionlly, existing OIDC providers will be required to update their key rotation logic.

### Alternative 4: let validators fetch JWKs during execution and discard transaction if results are split
One alternative is to fetch JWKs as part of the trasaction verification and discard the transaction if the verification results are split.

Reasons to not consider: DevOps complexity.
This requires refactoring of some fundamental building blocks of Aptos (e.g., decoupled execution), which might be too much implementation/testing complexity.

## Specification

### On-chain states

- `SupportedOIDCProviders`: a map from an OIDC provider (e.g., `https://accounts.google.com`) to watch, to its OpenID configuration URL.
- `ObservedJWKs`: a map from a provider to a pair of `(jwk_set, version)` that validators observed and agreed on.
- A feature flag to turn on/off the feature.

### On-chain events

- `ObservedJWKsUpdated`
    - Can contain a copy of `ObservedJWKs`.
    - Should be emitted when `ObservedJWKs` is updated by a transaction.
    - Validators should subscribe to reset its in-mem state accordingly.

### Governance operations

1. Turn on/off the feature.
1. Start/stop watching an OIDC provider (i.e., update `SupportedOIDCProviders`).
1. Delete all observed JWKs of an OIDC provider.
    - Typically used together with "stop watching an OIDC provider" to fully disable a provider (from the perspective of OIDB accounts). This can make validator-side logic simpler.
1. Patch the on-chain JWK collection.
    - Example use case: a single key is found compromised but the provider has not yet rotate it.

### Validator in-mem states

A validator, if a member of the validator set of the current epoch, should have the following states for every `provider` in the on-chain `SupportedOIDCProviders`.
- `latest_on_chain: LastestOnChainValue { jwks, version }`: should be maintained to be the latest value of `provider` in on-chain `ObservedJWKs` and used as the baseline for detecting JWK updates.
- `consensus_state: PerProviderConsensusState` : should capture the per-provider JWK consensus state. Below are the variants.
    - `NotStarted`: waiting for a new version of JWKs to be observed.
    - `InProgress{ob_jwks, version, task_handle}`: a new version of JWKs was observed (value being `ob`), running the certifying process with peers in a parallel task `task_handle`.
    - `Finished{ob_jwks, version}`: update `(ob_jwks, version)` was certified and proposed as a transaction to update the on-chain `ObservedJWKs`.

### Validator actions

A validator, if a member of the validator set of the current epoch, should do the following for each `provider` in the on-chain `SupportedOIDCProviders`, a validator
- On a new epoch:
    - start periodically fetching the latest JWKs from `provider`'s OpenID configuration;
    - load `ObservedJWKs` and initialize `latest_on_chain` with the according value of key `provider`.
    - initialize `consensus_state` to `NotStarted`.
- On a fetch result `ob_jwks`, if `ob_jwks != latest_on_chain.jwks`:
    - Start an async task `task_handle` to run the quorum-certifying process: broadcast to request every peer to sign its observed `(ob_jwks, version)` of `provider` and collect enough responses `(ob_jwks, version, sig)` that matches the local `(ob_jwks, latest_on_chain.version + 1)` to form a quorum-cert (a multi-signature of more than 2/3 of the epoch total voting power);
    - switch `consensus_state` to `InProgress(ob, latest_on_chain.version + 1, task_handle)`.
- Once a quorum-cert is formed for `(ob_jwks, version)`, if the state is `InProgress{ob_jwks, version, _}`:
    - propose a transaction to update the on-chain `ObservedJWKs` with the observed and quorum-certified `(ob_jwks, version)` of `provider`.
        - can leverage [validator transactions](https://github.com/aptos-foundation/AIPs/pull/274/files).
    - switch `consensus_state` to `Finished{ob_jwks, version}`.
- On an `ObservedJWKsUpdated` event where the value of `provider` is different from `latest_on_chain`:
    - reinitialize `latest_on_chain` with the new on-chain values;
    - switch `consensus_state` to `NotStarted`.
- Whenever switching `consensus_state` away from `InProgress(ob, version, task_handle)`, abort the certifying process `task_handle`.
- On a certifying request from a peer, if `consensus_state` is either `InProgress{ob_jwks, version, task_handle}` or `Finished{ob_jwks, version}`, sign `(ob_jwks, version)` and respond with `(ob_jwks, version, sig)` where `sig` is the signature.

### JWK update transaction execution

A JWK update transaction should take the following parameters:
- `epoch`: which epoch this update is generated and certified.
- `provider`: which provider's JWKs are being updated.
- `ob_jwks`: the new value of JWKs.
- `version`: the new version number that is supposed to be the old version number + 1.
- `multi_sig`: the set of signers that signed the update `(ob_jwks, version)` and their signatures aggreagted.

The execution should do the following check before updating the map `ObservedJWKs`.
- `epoch` is current.
- `version == on_chain_version + 1`, where `on_chain_version` is the one currently associated with `provider` in `ObservedJWKs`, or 0 otherwise.
- The signer set in `multi_sig` is a valid sub-set of the current validator set, and the voting power of the sub-set is more than 2/3 of the total voting power.
- The `multi_sig` itself is a valid signature of the update `(ob_jwks, version)` by the signer set.

### Remarks

Validators do not need to persist any off-chain states.

## Reference Implementation

 https://github.com/aptos-labs/aptos-core/pull/11528

## Risks and Drawbacks

Some new assumptions on the node environment are introduced. See [the security section](#security-and-liveness-considerations) for more details.

Actions are required on operators' end, but hopefully they are trivial.

## Future Potential

This AIP is mainly to support [AIP-61: OIDB accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md).

It's unclear how it can be leveraged further.


## Timeline

### Suggested implementation timeline

The implementation and testing should be completed by the end of Feb 2024.

### Suggested developer platform support timeline

This is primarily a validator change + new on-chain states, no SDK/API/CLI/Indexer support is required.

### Suggested deployment timeline

Release 1.10

## Security and Liveness Considerations

Below, we suppose the following 2 fundamental assumptions are valid and only discuss the assumtpions required for JWK consensus to work.
- The assumptions for blockchain main consensus.
- OIDC provider itself (mainly, its JWKs and HTTPS private keys) are secure.
    - Compromised OIDC providers are discussed in [AIP-61: OIDB accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md).

### Supporting a single OIDC provider

The proposed solution should work if more than 2/3 of the total validator voting power is staked in nodes that run in a secure environment for accessing the provider's APIs (typically in HTTPS), where a **secure environment for the provider** means that:
- the DNS servers being used to resolve the domain name of the provider's APIs (and the connection to them) are secure;
- the CA certs used to validate the HTTPS connections are secure.

More implications:
- If no more than 2/3 of the total validator voting power is held in a secure environment for the provider,
  new keys of the provider cannot be published on chain. (From the perspective of OIDB accounts, it is a liveness issue.)
- If more than 2/3 of the total validator voting power is held in a malicious environment for the provider (where DNS server and CA certs are both controlled by an attacker),
  malicious JWKs can be published on chain. (From the perspective of OIDB accounts, it means any user account associated with this provider can be corrupted.)

Some realistic scenarios where the assumptions may be invalid.
- Extremely imbalanced stake distribution. If a large amount of stake goes to a small set of validator nodes, it is in general easier to compromise.
- Geo-restriction. If too much stake goes to a validator node that runs in a region where the environment is blocking the communication to the provider API(or even manipulating), then JWK consensus can stall (or even let malicious JWKs through).
- DNS server/package manager as a potential single point of compromise.
Even without imbalanced stake distribution or geo-restriction, validator nodes are still very likely to share the same DNS server/package manager configurations, leaving the DNS server/package manager as the potential single point of compromise.

### Supporing multiple OIDC providers

Because the solution can be implemented in a per-provider manner, the assumption for supporting multiple providers can be simply the combination of the assumption for each individual provider. The only caveat is that 2 providers may be geo-restricted in different ways (e.g., provider 1 is blocked in region 2 and provider 2 is block in region 1) and thus can not be supported simultaneiously. In that case, we may want to switch to per-provider oracle networks.
