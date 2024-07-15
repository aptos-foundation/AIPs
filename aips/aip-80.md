---
aip: 80
title: Standardize Private Keys
author: Greg Nazario - greg@aptoslabs.com
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/405
Status: Draft
last-call-end-date (*optional): 04/30/2024
type: Standard (Ecosystem)
created: 04/19/2024
updated (*optional): 04/19/2024
requires (*optional): N/A
---

# AIP-80 - Standardize Private Keys

## Summary

This AIP defines how private keys should be represented off-chain. It provides a way for private keys to be differentiated
from addresses, and defines a way to determine which key scheme is associated.

### Goals

> What are the goals and what is in scope? Any metrics?

Private keys are indistinguishable from on-chain account addresses. This looks to change that by providing a solution to
differentiate private keys from on-chain addresses.

The main goal is to prevent people from accidentally leaking their private keys on-chain. This is commonly caused by
sending funds to a private key. Private keys, public keys, and account addresses are all represented today as 32-bytes or
64-hex characters (with or without a 0x prefix).  After that, someone may find this private key and rotate the account's
key on-chain.

The secondary goal is to keep this change to be as seamless as possible.

> Discuss the business impact and business value this change would impact.

This would reduce the number of accidentally lost keys on-chain.

### Out of Scope

> What are we committing to not doing and why are they scoped out?

Encryption of private keys at rest, as that is orthogonal to private keys being confused for addresses.

## Motivation

> Describe the impetus for this change. What does it accomplish?

This change should reduce the common case of users leaking their private keys on-chain.

> What might occur if we do not accept this proposal?

Users will continue at their normal rate of losing their private keys, and their accounts associated.

## Impact

> Which audiences are impacted by this change? What type of action does the audience need to take?

This affects users, and the wallets that they use. Wallets are the primary store of private keys, and any application
that is a wallet (mobile, extension, or in-app) or tool with a wallet (Aptos CLI) would need to adopt any new standards
around private keys, with backwards compatibility.

## Specification

> How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed
> design principles that should be followed in implementing this feature. Make the proposal specific enough to allow
> others to build upon it and perhaps even derive competing implementations.

### Add a prefix to private keys

Let's start with a supposed private key: `0x0000000000000000000000000000000000000000000000000000000000000001`

The private key format outputted by wallets, the CLI, and apps will have a prefix
e.g. `ed25519-priv-0x0000000000000000000000000000000000000000000000000000000000000001`.  
Wallets, the CLI, and apps will then take in two possible inputs for private keys:

1. Prefixed e.g. `ed25519-priv-0x0000000000000000000000000000000000000000000000000000000000000001`
2. Non-prefixed e.g. `0x0000000000000000000000000000000000000000000000000000000000000001`

The prefix will be composed of two parts: key scheme and key type. This will allow for differentiation between keys
with the same values, and the same key scheme.

1. Key scheme
    1. ed25519 -> Ed25519
    2. secp256k1 -> Secp256k1
2. Key type
    1. priv -> private key for now
    2. pub -> public key for now

This enables:

1. Identifying the associated signing scheme with the private key, for portability across different wallets and apps.
2. Rejection of new private key outputs for arguments that already validate for AccountAddress (`0x123...456`).
3. Backwards compatibility of previously saved private keys
4. Reduce impact to only input and output of wallet and wallet-like applications.

## Reference Implementation

> This is an optional yet highly encouraged section where you may include an example of what you are seeking in this
> proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository
> of code exemplifying the standard, or, for simpler cases, inline code.

TBD

## Testing (Optional)

> - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t
    need to be called out)
> - When can we expect the results?
> - What are the test results and are they what we expected? If not, explain the gap.

...

## Risks and Drawbacks

> - Express here the potential negative ramifications of taking on this proposal. What are the hazards?

The risk here is that private keys will not match across different wallets. The risk here is mitigated as the private
key is easy enough to remove the prefix, and the non-prefixed keys will still be accepted.

> - Any backwards compatibility issues we should be aware of?

None, since the old key will still be allowed to be imported.

> - If there are issues, how can we mitigate or resolve them?

I don't expect there to be any more issues than there are today with importing and saving of private keys.

## Alternative solutions

> Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible
> outcome?

### Change Address format

The address format could be changed from 64 hex characters, to another encoding. Other blockchains use bech32, and other
schemes for encoding addresses. This would change both the length, and the character set, to automatically block private
keys from being used in addresses.

This solution is not suggested, because it requires every application, indexer, on-chain-representation, exchange, and
user to change to the new format. Additionally, there needs to be backwards compatibility with the old address format,
which would then not solve this issue.

### Change Private key encoding to Base64

The private key format could change from 64 hex characters to a base64 (or other encoding) of the key. This provides the
ability for linters to check it, but be a regularly available format.

This solution is not suggested, because this may lead to leakage of keys on base64 to hex converters. Private keys
should
never be posted into any website.

### Only use mnemonics and paths

For future private keys, only use mnemonics and paths, to provide an easy difference with private keys. The derivation
path will differentiate between the private keys.

This solution doesn't allow for custom private keys, nor does it allow for easy backwards compatibility of private keys.
Most wallets already support mnemonics, but private keys are more specific to which derive path is used.

This doesn't allow for backwards compatibility of current saved private keys, but it could be used in the future.

## Future Potential

> Think through the evolution of this proposal well into the future. How do you see this playing out? What would this
> proposal result in one year? In five years?

In the future, this should allow for being able to differentiate between keys across key schemes, and scale to different
key types. It will make it very explicit if a wallet can support or not support the key.

Looking forward, it might have better potential to explore an encrypted key, for storing at rest.

## Timeline

### Suggested implementation timeline

> Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

- Milestone 1: New key format as input and output
    - Implementation should take 2 week, to update the Rust, Python, Unity, and TypeScript SDKs to consume the new key
      format.
- Milestone 2:
    - This requires working with every wallet and app to output the new standard. This will likely take 2-3 months,
      given most wallets are on the legacy TypeScript SDK.

### Suggested developer platform support timeline

> Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable.

This change is entirely on development platform, and it should only be 2 weeks of support there.

### Suggested deployment timeline

> Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on
> our three networks (e.g., release 1.7).
> You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design
> review.
>
> - On devnet?
> - On testnet?
> - On mainnet?

Deployment across all systems is not necessary of any particular timeline. However, it would be good to do the
following:

1. Month 1: 4 wallets accept the new private key scheme as an input
2. Month 2: Change those wallets to output the new private key scheme
3. Month 3: Make a campaign to fix other applications like games that may take in / output private keys.

## Security Considerations

> - Does this result in a change of security assumptions or our threat model?

This should not change any security assumptions or threat model.

> - Any potential scams? What are the mitigation strategies?

I don't suspect any potential scams, since it's a simple prefix

> - Any security implications/considerations?

No.

> - Any security design docs or auditing materials that can be shared?

No.

## Open Questions (Optional)

> Q&A here, some of them can have answers some of those questions can be things we have not figured out, but we should
