---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Removing balance check for dispatchable fungible asset
author: Runtian Zhou
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): 4/20/2025
type: Framework
created: 04/11/2025
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Removing balance check for dispatchable fungible asset
  
## Summary

Remove the minimum balance check for withdraw function in the dispatchable fungible asset.
The current framework code is unusable for dispatchable fungible asset that tries to register both the withdraw and the balance hook, making adoption hard for users who need both function hooks.

### Out of scope

N/A

## High-level Overview

Right now, the withdraw function in the dispatchable fungible asset has an assertion to ensure a minimum balance change upon withdraw. This checks were implemented to prevent token issuers
to make mistakes and NOT withdraw assets in the hook. This was an explicit ask from the DeFi builders in the ecosystem as they were concerned that the hooked asset can potentially mess up the 
asset pool maintained by the smart contract by not withdrawing enough fund when withdrawal happens.

After leaving this checks in prod for half a year, we suggest that this check should not be needed for the following reasons:
1. The issuers for the dispatchable fungible assets have their full on control over both the asset mint and transfer process. If asset issuers intentionally wanted to mess up with the pool, there were few things that the protocol (Aptos Framework) can do.
2. It should be the dispatchable fungible assets' duty to ensure the semantics for the transfer function.
3. This check is preventing DeFi developers to develop other innovative solutions. e.g: an yield bearing token. In the yield bearing case, due to truncation, it is possible that the constraint is violated.

## Impact

Since we are removing an existing constraint, this should have no impact to existing dispatchable fungible asset. It would only impact future dispatchable fungible asset.

## Alternative Solutions

Alternatively, we can keep the check and use the dispatched derive_balance function to check whether the withdraw amount is at least as provided. However, we suggest that this is the duty of the token issuer, not the framework to enforce such checks, as framework has no idea what the hook semantics are behind the scene.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/16313

## Testing 

See PR.

## Risks and Drawbacks

Will relaxing withdraw constraint affect DeFi protocols that takes dispatchable fungible asset? 

## Security Considerations

This change removes a framework-level guardrail that ensures at least the expected amount was withdrawn. With this check gone, it is now the responsibility of the asset implementer to enforce correct withdrawal semantics.

While this increases flexibility (e.g., for yield-bearing tokens), it also opens room for misbehaving or malicious hooks that under-withdraw. Protocols integrating with dispatchable assets should not rely on framework-enforced behavior and are encouraged to apply their own validations — which is something they should already be doing as a best practice.

## Timeline

- Branch cut: 4/23
- Devnet: 4/23
- Testnet binary: 4/28
- Testnet framework: 4/30
- Mainnet binary: 5/05
- Mainnet framework: 5/12
