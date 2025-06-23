---
aip: 128
title: Multisig Script Payloads
author: gregnazario (greg@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/619
Status: In Review
type: Standard (Core, Framework)
created: 06/05/2025
updated (*optional): 06/23/2025
requires (*optional): 12
---

# AIP-128 - Multisig Script Payloads

## Summary

Provides the flexibility to use multisig script payloads in transactions, allowing for more complex transaction logic
and enabling the use of multisig accounts in a more flexible manner. The functionality here would be similar to how
governance works on Aptos.

The problem we're solving is the ability to easily run arbitrary code through a multisig, without having to deploy a new
contract every time. This is particularly useful for governance and other scenarios where you want to execute complex
logic in a multisig context.

Goal is to unblock protocols from using multisig for any use case.

### Out of scope

Not committed to changing the way multisig accounts work, or how transactions are executed. This is purely about which
payloads can be used for a multisig account.

## High-level Overview

High level, there already is support for other types of payloads in both orderless and standard transactions. However,
Script payloads were not supported from the beginning of the newer multisig account design. The goal here is to take
advantage of existing extensibility in the framework and VM to allow script payloads to be used for a multisig.

## Impact

Many defi protocols have asked for script payloads around their protocols to be used in multisig accounts. This was
specifically to allow for the flexibility of quickly changing logic at the time of submission for approval, without
having to deploy code every time.

If we don't accept this proposal, then protocols will have to continue to deploy new contracts every time they want to
run arbitrary code through a multisig. This is a significant burden and can lead to inefficiencies in the process of
multisig.

## Alternative Solutions

The alternative today is to continue to deploy new contracts every time a multisig wants to run arbitrary code.

## Specification and Implementation Details

1. Add a new `ScriptPayload` variant to the `MultisigPayload` enum in the Aptos core types.

```rust
 #[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
 pub enum MultisigTransactionPayload {
     EntryFunction(EntryFunction),
     Script(Script),
 }
```

2. Add support in the REST API and VM to support Scripts, taking advantage of the existing functions used for it.
3. Update the TypeScript SDK to support the new `ScriptPayload` variant, allowing users to create transactions with
   script payloads in multisig accounts.
4. Update indexer SDK to support the new `ScriptPayload` variant, allowing users to query transactions with script
   payloads in multisig accounts.
5. Update the indexer processor to handle the new type if it's doing anything special with multisig transactions.
6. Update Petra, Aptos Connect, and other wallets to support the new `ScriptPayload` variant, allowing users to
   create transactions with script payloads in multisig accounts.
7. Update existing multisig wallet dapps to support the new `ScriptPayload` variant, allowing users to
   create transactions with script payloads in multisig accounts.

## Reference Implementation

Aptos core code is here: https://github.com/aptos-labs/aptos-core/pull/16778

## Testing

We're relying on the existing script execution logic in the VM, which has been thoroughly tested. The new `ScriptPayload`
variant will be tested through unit tests in the Aptos core codebase, as well as integration tests in the TypeScript SDK
and indexer SDK.

## Risks and Drawbacks

Risk is if there is a bug in the script payload, it could lead to unexpected behavior in the multisig account. This is
mitigated by using existing script execution logic in the VM, which has been thoroughly tested.

A feature flag will be added to the framework to allow for this functionality to be enabled or disabled. This will let
us disable it in the event of a bug or unexpected behavior.

## Security Considerations

We'll need to just ensure that the script payloads are executed the same as any other script payload, and that nothing
else can change there.

## Future Potential

N/A

## Timeline

### Suggested implementation timeline

> Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

...

### Suggested developer platform support timeline

> **Optional:** Describe the plan to have SDK, API, CLI, Indexer support for this feature, if applicable.

...

### Suggested deployment timeline

> **Optional:** Indicate a future release version as a *rough* estimate for when the community should expect to see this
> deployed on our three networks (e.g., release 1.7).
> You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design
> review.
>
> - On devnet?
> - On testnet?
> - On mainnet?

...

## Open Questions (Optional)

> Q&A here, some of them can have answers some of those questions can be things we have not figured out, but we should

...
