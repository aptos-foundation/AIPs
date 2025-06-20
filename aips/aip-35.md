---
aip: 35
title: Charging Invariant Violation Errors 
author: runtian@aptoslabs.com
discussions-to: https://github.com/aptos-foundation/AIPs/issues/144
Status: Accepted
type: Informational
created: 05/17/2023
---

# AIP-35 - Charging Invariant Violation Errors
  
## Summary

Charge transactions that trigger invariant violation errors instead of discarding them.

## Motivation

An _invariant violation error_ is a special type of error that gets triggered in the Aptos VM when some unexpected invariants are being violated. Right now, transactions that trigger such errors will be marked as discarded, which could potentially be a DDoS vector for our network as it allows users to submit computations without being charged.

An example of transactions that could trigger an invariant violation error are transactions that violate MoveVM's paranoid type checker.

## Impact

User shouldn't be expecting any impact as this is just a precautionary change. We expect that transactions that are compiled from Move compiler to not be affected by this change.

## Rationale

The concern that this AIP is trying to address is that if user finds a way to create an invariant violation error deterministically (which usually indicates a bug in our own implementation), users can send a number of transactions that trigger this behavior without being charged. This would easily consume our computation resources and potentially cause the network to halt. 

## Specification

The change itself should be straightforward. We just need to change the status of invariant violation transactions from `discard` to `keep` and make sure we invoke the proper epilogue. The only thing we need to make sure is that we don't mess up with the error translation logic in other error categories, which may cause backward compatibility issues.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/8213/files

## Risks and Drawbacks

The potential risk is on the overall maintainablity of the node software. Now that we start to persist TXNs that cause invariant violation errors, we will need to reproduce the "error" behavior when there is such error. This is mitigatable though as we can mark such transactions to be no longer reproduceable in our testing pipeline.

## Future Potential

N/A

## Timeline

### Suggested implementation timeline

We plan to fix it with https://github.com/aptos-labs/aptos-core/pull/8213/files.
  
### Suggested developer platform support timeline

N/A

### Suggested deployment timeline

We are looking to activate this change in the 1.5 release on testnet/mainnet.

## Security Considerations

The change will be gated under a feature flag so it won't be activated until a governance proposal has been set.

## Testing (optional)

See the [PR's](https://github.com/aptos-labs/aptos-core/pull/8213/files) testing section. A failpoint injection was used to make sure the change is protected by a feature flag.

