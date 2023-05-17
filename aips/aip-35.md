---
aip: 35
title: Charging Invariant Violation Errors 
author: runtian@aptoslabs.com
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
type: Informational
created: 05/17/2023
---

# AIP-X - Charging Invariant Violation Errors 
  
## Summary

Charge transactions that triggered invariant violation error instead of discarding them.

## Motivation

Invariant violation error is a special type of errors that gets triggered in the Aptos VM where some unexpected invariants are being violated. Right now transactions that triggered such error will be marked as discarded which could potentially be a DDoS vector for our network as it leaves users to be able to submit computations without being charged.

Examples of transactions that could trigger an invariant violation errors are transactions that violates MoveVM's paranoid type checker.

## Impact

User shouldn't be expecting any impact as this is just a precautionary change. We expect that transactions that are compiled from Move compiler shouldn't be affected this change.

## Rationale

The concern that this AIP is trying to address is that if user find a way to create invariant violation error deterministically (which usually indicates a bug in our own implementation), users can send a number of transactions that triggered this behavior without being charged and this would easily consume our computation resource and potentially cause the network to halt. 

## Specification

The change itself should be straightforward. We jsut need to change the status of invariant violation transactions from discard to keep and make sure we invoke the proper epilogue. The only thing we need to make sure is that we don't mess up with the error translation logic in other error categories, which may cause backward compatibility issue,

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/8213/files

## Risks and Drawbacks

The potential risk is on the overall maintainablity of the node software. Now that we start to persist those txns, we will need to reproduce the "error" behavior when there is such error. This is mitigatable though as we can mark those transactions to be no longer reproduceable in our testing pipeline.

## Future Potential

N/A

## Timeline

### Suggested implementation timeline

Plan to fix it with https://github.com/aptos-labs/aptos-core/pull/8213/files
  
### Suggested developer platform support timeline

N/A

### Suggested deployment timeline

We are looking into activate this change in 1.5 release on testnet/mainnet.

## Security Considerations

The change will be gated under a feature flag so it won't be activated until a governance proposal has been set.

## Testing (optional)

See PRs testing section. A failpoint injection was used to make sure the change is protected by a feature flag.

